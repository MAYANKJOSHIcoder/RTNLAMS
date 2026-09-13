import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { AREA_UNITS, UNIT_LABELS, toHectares, type AreaUnit } from '../../lib/units';
import { LAND_USE_MULTIPLIER } from '../../lib/compensation';
import type { Parcel } from '../../lib/types';

const schema = z.object({
  parcel_number: z.string().trim().min(1, 'Parcel number is required'),
  owner_name: z.string().trim().min(1, 'Owner name is required'),
  owner_aadhaar: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{12}$/.test(v), 'Aadhaar must be exactly 12 digits (or empty)'),
  area_value: z
    .string()
    .refine((v) => v !== '' && Number.isFinite(Number(v)) && Number(v) > 0, 'Area must be a positive number')
    .transform((v) => Number(v)),
  area_unit: z.enum(['sqm', 'sqft', 'gaj', 'acre', 'hectare']),
  land_use: z.string().optional(),
  village: z.string().trim().optional(),
  district: z.string().trim().optional(),
  state: z.string().trim().optional(),
  survey_number: z.string().trim().optional(),
  latitude: z.string().trim().optional(),
  longitude: z.string().trim().optional(),
}).superRefine((data, ctx) => {
  const hasLat = data.latitude !== undefined && data.latitude !== '';
  const hasLng = data.longitude !== undefined && data.longitude !== '';
  if (hasLat !== hasLng) {
    ctx.addIssue({
      code: 'custom',
      path: hasLat ? ['longitude'] : ['latitude'],
      message: 'Enter both latitude and longitude',
    });
    return;
  }
  if (!hasLat || !hasLng) return;
  const lat = Number(data.latitude);
  const lng = Number(data.longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    ctx.addIssue({ code: 'custom', path: ['latitude'], message: 'Latitude must be between -90 and 90' });
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    ctx.addIssue({ code: 'custom', path: ['longitude'], message: 'Longitude must be between -180 and 180' });
  }
});

type FormData = z.infer<typeof schema>;
type FormInput = z.input<typeof schema>;

interface AddParcelModalProps {
  open: boolean;
  projectId: string | null;
  onClose: () => void;
  onCreate: (parcel: Partial<Parcel>) => void;
  creating?: boolean;
}

function pointToParcelPolygon(latitude?: string, longitude?: string): Parcel['geometry'] {
  if (!latitude || !longitude) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const d = 0.004;
  return {
    type: 'Polygon',
    coordinates: [[
      [lng - d, lat - d],
      [lng + d, lat - d],
      [lng + d, lat + d],
      [lng - d, lat + d],
      [lng - d, lat - d],
    ]],
  };
}

export default function AddParcelModal({ open, projectId, onClose, onCreate, creating }: AddParcelModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: { area_unit: 'hectare', land_use: 'agricultural' },
  });

  const submit = handleSubmit((data) => {
    if (!projectId) return;
    onCreate({
      parcel_number: data.parcel_number,
      owner_name: data.owner_name,
      owner_aadhaar: data.owner_aadhaar || null,
      area_hectares: toHectares(data.area_value, data.area_unit),
      land_use: data.land_use || null,
      village: data.village || null,
      district: data.district || null,
      state: data.state || null,
      survey_number: data.survey_number || null,
      project_id: projectId,
      latitude: data.latitude ? Number(data.latitude) : null,
      longitude: data.longitude ? Number(data.longitude) : null,
      geometry: pointToParcelPolygon(data.latitude, data.longitude),
    });
  });

  const close = () => {
    reset();
    onClose();
  };

  const inputCls = (err: unknown) =>
    `w-full h-10 px-3 border rounded-md text-sm bg-[#0c0c0c] focus:outline-none focus:ring-2 focus:ring-[#38bdf8] ${err ? 'border-red-500' : 'border-slate-300'}`;

  return (
    <Modal open={open} onClose={close} title="Add New Parcel">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Parcel number <span className="text-red-600">*</span>
            </label>
            <input {...register('parcel_number')} className={inputCls(errors.parcel_number)} placeholder="DL-SURV-031" />
            {errors.parcel_number && <p role="alert" className="text-xs text-red-600 mt-1">{errors.parcel_number.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Owner name <span className="text-red-600">*</span>
            </label>
            <input {...register('owner_name')} className={inputCls(errors.owner_name)} placeholder="Rajesh Kumar" />
            {errors.owner_name && <p role="alert" className="text-xs text-red-600 mt-1">{errors.owner_name.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Owner Aadhaar</label>
          <input {...register('owner_aadhaar')} inputMode="numeric" maxLength={12} className={inputCls(errors.owner_aadhaar)} placeholder="12 digits — links the owner's citizen account (optional)" />
          {errors.owner_aadhaar && <p role="alert" className="text-xs text-red-600 mt-1">{errors.owner_aadhaar.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Area <span className="text-red-600">*</span>
            </label>
            <input {...register('area_value')} type="number" step="any" min="0" className={inputCls(errors.area_value)} placeholder="2.5" />
            {errors.area_value && <p role="alert" className="text-xs text-red-600 mt-1">{errors.area_value.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Unit</label>
            <select {...register('area_unit')} className={inputCls(false)}>
              {AREA_UNITS.map((u: AreaUnit) => (
                <option key={u} value={u}>{UNIT_LABELS[u]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Land use</label>
            <select {...register('land_use')} className={inputCls(false)}>
              {Object.keys(LAND_USE_MULTIPLIER).map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Survey number</label>
            <input {...register('survey_number')} className={inputCls(errors.survey_number)} placeholder="Khasra / survey no." />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Village</label>
            <input {...register('village')} className={inputCls(errors.village)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">District</label>
            <input {...register('district')} className={inputCls(errors.district)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">State</label>
            <input {...register('state')} className={inputCls(errors.state)} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Latitude</label>
            <input {...register('latitude')} inputMode="decimal" className={inputCls(errors.latitude)} placeholder="28.6139" />
            {errors.latitude && <p role="alert" className="text-xs text-red-600 mt-1">{errors.latitude.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Longitude</label>
            <input {...register('longitude')} inputMode="decimal" className={inputCls(errors.longitude)} placeholder="77.2090" />
            {errors.longitude && <p role="alert" className="text-xs text-red-600 mt-1">{errors.longitude.message}</p>}
          </div>
        </div>

        <p className="text-xs text-slate-500">Area converts to hectares at save. Coordinates draw the parcel on the map. The 12-stage lifecycle starts automatically.</p>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={close}>Cancel</Button>
          <Button type="submit" loading={creating}>Create Parcel</Button>
        </div>
      </form>
    </Modal>
  );
}
