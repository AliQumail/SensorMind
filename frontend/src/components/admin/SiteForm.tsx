import {
  EQUIPMENT_SHAPES,
  EQUIPMENT_TEMPLATES,
  EQUIPMENT_TYPES,
  newEquipment,
  slug,
  uniqueId,
  type EquipmentConfig,
  type FloorConfig,
  type GroupConfig,
  type SiteConfig,
  type TagConfig,
} from './siteConfig'
import { Button, Field, NumberInput, TextInput, inputClass } from './ui'

/** The UI view: forms over the same SiteConfig object the JSON view edits. */
export function SiteForm({ config, onChange }: { config: SiteConfig; onChange: (config: SiteConfig) => void }) {
  const edit = (change: (draft: SiteConfig) => void) => {
    const draft = structuredClone(config)
    change(draft)
    onChange(draft)
  }
  const { site } = config

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Site name">
          <TextInput value={site.name} onChange={(v) => edit((d) => (d.site.name = v))} />
        </Field>
        <Field label="Location (optional)">
          <TextInput value={site.location ?? ''} onChange={(v) => edit((d) => (d.site.location = v || undefined))} />
        </Field>
      </div>

      {site.floors.map((floor, fi) => (
        <FloorCard key={fi} floor={floor} config={config} edit={edit} fi={fi} />
      ))}

      <Button
        onClick={() =>
          edit((d) => {
            const id = uniqueId('floor', new Set(d.site.floors.map((f) => f.id)))
            d.site.floors.push({ id, name: 'New Floor', level: d.site.floors.length, size: { width: 30, depth: 18 }, groups: [] })
          })
        }
      >
        + Add floor
      </Button>
    </div>
  )
}

type Edit = (change: (draft: SiteConfig) => void) => void

function FloorCard({ floor, config, edit, fi }: { floor: FloorConfig; config: SiteConfig; edit: Edit; fi: number }) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface-raised p-3">
      <div className="flex items-end gap-2">
        <Field label="Floor name" className="flex-1">
          <TextInput value={floor.name} onChange={(v) => edit((d) => (d.site.floors[fi].name = v))} />
        </Field>
        <Field label="Level" className="w-16">
          <NumberInput value={floor.level} onChange={(v) => edit((d) => (d.site.floors[fi].level = v ?? 0))} />
        </Field>
        <Field label="Width (m)" className="w-20">
          <NumberInput value={floor.size.width} onChange={(v) => edit((d) => (d.site.floors[fi].size.width = v ?? 0))} />
        </Field>
        <Field label="Depth (m)" className="w-20">
          <NumberInput value={floor.size.depth} onChange={(v) => edit((d) => (d.site.floors[fi].size.depth = v ?? 0))} />
        </Field>
        <Button
          variant="danger"
          disabled={config.site.floors.length === 1}
          onClick={() => edit((d) => d.site.floors.splice(fi, 1))}
        >
          Remove
        </Button>
      </div>

      {floor.groups.map((group, gi) => (
        <GroupCard key={gi} group={group} edit={edit} fi={fi} gi={gi} />
      ))}

      <Button
        onClick={() =>
          edit((d) => {
            const taken = new Set(d.site.floors.flatMap((f) => f.groups.map((g) => g.id)))
            d.site.floors[fi].groups.push({ id: uniqueId('grp-group', taken), name: 'New Group', equipment: [] })
          })
        }
      >
        + Add group
      </Button>
    </section>
  )
}

function GroupCard({ group, edit, fi, gi }: { group: GroupConfig; edit: Edit; fi: number; gi: number }) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-end gap-2">
        <Field label="Group name" className="flex-1">
          <TextInput value={group.name} onChange={(v) => edit((d) => (d.site.floors[fi].groups[gi].name = v))} />
        </Field>
        <Button variant="danger" onClick={() => edit((d) => d.site.floors[fi].groups.splice(gi, 1))}>
          Remove group
        </Button>
      </div>

      {group.equipment.map((equipment, ei) => (
        <EquipmentCard key={ei} equipment={equipment} edit={edit} fi={fi} gi={gi} ei={ei} />
      ))}

      <select
        aria-label="Add equipment from a template"
        value=""
        onChange={(e) => {
          const template = EQUIPMENT_TEMPLATES[Number(e.target.value)]
          if (template) edit((d) => d.site.floors[fi].groups[gi].equipment.push(newEquipment(template, d)))
        }}
        className={`${inputClass} w-auto`}
      >
        <option value="">+ Add equipment from template…</option>
        {EQUIPMENT_TEMPLATES.map((template, i) => (
          <option key={template.label} value={i}>
            {template.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function EquipmentCard({ equipment, edit, fi, gi, ei }: { equipment: EquipmentConfig; edit: Edit; fi: number; gi: number; ei: number }) {
  const set = (change: (e: EquipmentConfig) => void) => edit((d) => change(d.site.floors[fi].groups[gi].equipment[ei]))

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-raised p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <Field label="Name" className="sm:col-span-2">
          <TextInput value={equipment.name} onChange={(v) => set((e) => (e.name = v))} />
        </Field>
        <Field label="Type">
          <select value={equipment.type} onChange={(ev) => set((e) => (e.type = ev.target.value as typeof e.type))} className={inputClass}>
            {EQUIPMENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Shape">
          <select value={equipment.shape} onChange={(ev) => set((e) => (e.shape = ev.target.value as typeof e.shape))} className={inputClass}>
            {EQUIPMENT_SHAPES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Manufacturer">
          <TextInput value={equipment.manufacturer} onChange={(v) => set((e) => (e.manufacturer = v))} />
        </Field>
        <Field label="Model">
          <TextInput value={equipment.model} onChange={(v) => set((e) => (e.model = v))} />
        </Field>
        <Field label="Position x (m)">
          <NumberInput value={equipment.position.x} onChange={(v) => set((e) => (e.position.x = v ?? 0))} />
        </Field>
        <Field label="Position z (m)">
          <NumberInput value={equipment.position.z} onChange={(v) => set((e) => (e.position.z = v ?? 0))} />
        </Field>
        <Field label="Size x">
          <NumberInput value={equipment.size.x} onChange={(v) => set((e) => (e.size.x = v ?? 0))} />
        </Field>
        <Field label="Size y">
          <NumberInput value={equipment.size.y} onChange={(v) => set((e) => (e.size.y = v ?? 0))} />
        </Field>
        <Field label="Size z">
          <NumberInput value={equipment.size.z} onChange={(v) => set((e) => (e.size.z = v ?? 0))} />
        </Field>
        <div className="flex items-end justify-end">
          <Button variant="danger" onClick={() => edit((d) => d.site.floors[fi].groups[gi].equipment.splice(ei, 1))}>
            Remove equipment
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-text-muted">Tags</p>
        {equipment.tags.map((tag, ti) => (
          <TagRow key={ti} tag={tag} set={(change) => set((e) => change(e.tags[ti]))} remove={() => set((e) => e.tags.splice(ti, 1))} />
        ))}
        <Button
          onClick={() =>
            edit((d) => {
              const target = d.site.floors[fi].groups[gi].equipment[ei]
              const name = 'New Tag'
              target.tags.push({
                id: uniqueId(`${d.site.id}.${target.id}.${slug(name)}`, new Set(target.tags.map((t) => t.id))),
                name,
                unit: '',
                nominalMin: 0,
                nominalMax: 1,
              })
            })
          }
        >
          + Add tag
        </Button>
      </div>
    </div>
  )
}

function TagRow({ tag, set, remove }: { tag: TagConfig; set: (change: (t: TagConfig) => void) => void; remove: () => void }) {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_4rem_repeat(4,minmax(0,1fr))_auto] items-end gap-2">
      <Field label="Name">
        <TextInput value={tag.name} onChange={(v) => set((t) => (t.name = v))} />
      </Field>
      <Field label="Unit">
        <TextInput value={tag.unit} onChange={(v) => set((t) => (t.unit = v))} />
      </Field>
      <Field label="Nominal min">
        <NumberInput value={tag.nominalMin} onChange={(v) => set((t) => (t.nominalMin = v ?? 0))} />
      </Field>
      <Field label="Nominal max">
        <NumberInput value={tag.nominalMax} onChange={(v) => set((t) => (t.nominalMax = v ?? 0))} />
      </Field>
      <Field label="Alarm low">
        <NumberInput optional value={tag.alarmLow} onChange={(v) => set((t) => (t.alarmLow = v))} />
      </Field>
      <Field label="Alarm high">
        <NumberInput optional value={tag.alarmHigh} onChange={(v) => set((t) => (t.alarmHigh = v))} />
      </Field>
      <Button variant="danger" onClick={remove} aria-label={`Remove tag ${tag.name}`}>
        ✕
      </Button>
    </div>
  )
}
