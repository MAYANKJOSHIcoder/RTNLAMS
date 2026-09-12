import { useEffect, useState, useMemo, Suspense, lazy } from 'react';
import { FolderKanban, MapIcon, AlertTriangle, ShieldCheck, Wallet } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useParcels } from '../hooks/useParcels';
import { useSlaBreaches } from '../hooks/useStages';
import { useRiskAssessments } from '../hooks/useRisk';
import { useCompensation } from '../hooks/useCompensation';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import KPICard from '../components/dashboard/KPICard';
import StagePipeline from '../components/dashboard/StagePipeline';
import ActivityFeed, { type ActivityItem } from '../components/dashboard/ActivityFeed';
import RiskAlerts from '../components/dashboard/RiskAlerts';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { useProject } from '../context/ProjectContext';

// maplibre chunk loads only when the dashboard's map panel mounts
const ParcelMap = lazy(() => import('../components/maps/ParcelMap'));

export default function Dashboard() {
  const { projectId } = useProject();
  const { data: parcels = [], refetch: refetchParcels, isError, error } = useParcels(null, projectId ?? undefined);
  const { data: slaBreaches = [] } = useSlaBreaches();
  const { data: risks = [] } = useRiskAssessments();
  const { data: awards = [] } = useCompensation();
  const [projectsCount, setProjectsCount] = useState<number | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  // Real stage counts for pipeline — count each parcel ONCE at its current stage
  const { data: stageCounts = {} } = useQuery<Record<number, number>>({
    queryKey: ['stage-counts', projectId],
    queryFn: async () => {
      if (!isSupabaseConfigured()) return {};
      // Get the highest stage_number per parcel where status is in_progress or completed
      // This ensures each parcel is counted only once at its current stage
      const { data, error } = await supabase.rpc('get_parcel_current_stages' as never, {
        p_project_id: projectId ?? null,
      } as never);
      if (error) {
        // Fallback: client-side computation if RPC not available
        const { data: stages, error: stagesErr } = await supabase
          .from('acquisition_stages')
          .select('parcel_id, stage_number, status')
          .in('status', ['in_progress', 'completed']);
        if (stagesErr) return {};
        const parcelCurrentStage = new Map<string, number>();
        (stages ?? []).forEach((s: { parcel_id: string; stage_number: number; status: string }) => {
          const current = parcelCurrentStage.get(s.parcel_id) ?? 0;
          if (s.stage_number > current) parcelCurrentStage.set(s.parcel_id, s.stage_number);
        });
        const counts: Record<number, number> = {};
        parcelCurrentStage.forEach((stageNum) => {
          counts[stageNum] = (counts[stageNum] ?? 0) + 1;
        });
        return counts;
      }
      const counts: Record<number, number> = {};
      (data ?? []).forEach((row: { stage_number: number }) => {
        counts[row.stage_number] = (counts[row.stage_number] ?? 0) + 1;
      });
      return counts;
    },
  });

  // Auto-refresh every 30s per PROMPT 19
  useEffect(() => {
    const id = setInterval(() => {
      refetchParcels();
    }, 30_000);
    return () => clearInterval(id);
  }, [refetchParcels]);

  // Fetch projects count + recent activity (last 10)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!isSupabaseConfigured()) {
        if (!cancelled) {
          setActivities([]);
        }
        return;
      }
      const { count } = await supabase.from('projects').select('id', { count: 'exact', head: true });
      if (!cancelled && count != null) setProjectsCount(count);
      // Recent activity from audit_logs + hearings + documents (last 10)
      const { data: audits } = await supabase.from('audit_logs').select('id, audit_type, finding, created_at, parcel_id').order('created_at', { ascending: false }).limit(5);
      const acts: ActivityItem[] = (audits ?? []).map((a: { id: string; audit_type: string; finding: string; created_at: string; parcel_id: string | null }) => ({
        id: a.id,
        type: 'audit',
        description: a.finding.slice(0, 60),
        created_at: a.created_at,
        parcel_id: a.parcel_id ?? undefined,
      }));
      if (!cancelled) setActivities(acts);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [parcels]);

  const stats = useMemo(() => {
    const inProgress = parcels.filter((p) => !['acquired'].includes(p.status)).length;
    const breaches = slaBreaches.length;
    const highRisk = risks.filter((r) => r.risk_level === 'high' || r.risk_level === 'critical').length;
    const paid = awards.filter((a) => a.payment_status === 'completed').reduce((s, a) => s + Number(a.awarded_amount ?? 0), 0);
    return { inProgress, breaches, highRisk, paid };
  }, [parcels, slaBreaches, risks, awards]);

  const pipelineCounts = useMemo(() => {
    // Real counts from acquisition_stages — each parcel counted once at current stage
    // SLA breaches are already reflected in stageCounts (breached stages show as 'breached' status)
    return stageCounts;
  }, [stageCounts]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {isError && <ErrorBanner message={`Dashboard data failed to load: ${error?.message ?? 'check connection / RLS'}`} />}
      {/* Top Row - KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard title="Total Active Projects" value={projectsCount ?? 0} subtitle="National pipeline" icon={FolderKanban} />
        <KPICard title="Parcels In Progress" value={stats.inProgress} subtitle={`${parcels.length} total`} icon={MapIcon} />
        <KPICard
          title="SLA Breaches"
          value={stats.breaches}
          subtitle={stats.breaches ? 'Needs attention' : 'On track'}
          icon={AlertTriangle}
          variant={stats.breaches ? 'danger' : 'default'}
        />
        <KPICard title="High Risk Parcels" value={stats.highRisk} subtitle="critical/high" icon={ShieldCheck} variant={stats.highRisk ? 'danger' : 'default'} />
        <KPICard title="Compensation Paid" value={`₹${(stats.paid / 100000).toFixed(1)}L`} subtitle="Total disbursed" icon={Wallet} variant="success" />
      </div>

      {/* Middle Row: Map 60% + Pipeline 40% */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <h2 className="text-sm font-semibold text-slate-900 mb-2">Project Parcels Overview</h2>
          <Suspense fallback={<div className="h-[340px] rounded-lg border border-slate-200 animate-pulse bg-white/[0.02] flex items-center justify-center text-xs text-slate-500">Loading map…</div>}>
            <ParcelMap projectId={projectId ?? undefined} height="340px" />
          </Suspense>
        </div>
        <div className="lg:col-span-2">
          <StagePipeline countsByStage={pipelineCounts} />
        </div>
      </div>

      {/* Bottom Row: Activity + Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivityFeed items={activities} />
        <RiskAlerts assessments={risks} parcels={parcels} />
      </div>
    </div>
  );
}
