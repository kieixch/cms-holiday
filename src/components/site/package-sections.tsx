export type ScheduleItemData = {
  id: string;
  /** Teks: angka tanggal ("12") atau "-" bila tanggal belum diumumkan. */
  day: string;
  month: string;
  year: string;
  description: string;
};

/**
 * Daftar jadwal keberangkatan, dirender di atas itinerary.
 *
 * Tanggal dipisah menjadi angka besar (hari) dan baris bulan-tahun supaya
 * mudah dipindai, persis kebutuhan jadwal open trip. Deskripsi opsional —
 * biasanya berisi sisa kuota atau catatan keberangkatan.
 */
export function ScheduleGrid({ items }: { items: ScheduleItemData[] }) {
  if (items.length === 0) return null;
  return (
    <div className="hbgl-schedule">
      {items.map((s) => (
        <div className="hbgl-schedule__item" key={s.id}>
          <div className="hbgl-schedule__date">
            <span className="hbgl-schedule__day">{s.day}</span>
            <span className="hbgl-schedule__my">
              {s.month} {s.year}
            </span>
          </div>
          {s.description ? <p className="hbgl-schedule__desc">{s.description}</p> : null}
        </div>
      ))}
    </div>
  );
}

export type ItineraryDayData = {
  id: string;
  emoji: string;
  label: string;
  title: string;
  items: { time: string; text: string }[];
};

/**
 * Kartu itinerary per hari.
 *
 * `columns` berasal dari CSS asli halaman tersebut (lihat Package.itineraryColumns):
 * halaman 2D1N = 2 kolom, 3D2N = 3 kolom, sisanya 1 kolom.
 */
export function ItineraryGrid({
  days,
  columns,
}: {
  days: ItineraryDayData[];
  columns: number;
}) {
  if (days.length === 0) return null;
  const cols = Math.max(1, Math.min(3, columns || 1));
  return (
    <div className={`itin-grid cols-${cols}`}>
      {days.map((d) => (
        <div className="itin-card" key={d.id}>
          <div className="itin-card-head">
            <div className="emoji">{d.emoji}</div>
            <div>
              <span>{d.label}</span>
              <h3>{d.title}</h3>
            </div>
          </div>
          <ul className="timeline">
            {d.items.map((it, i) => (
              <li key={`${d.id}-${i}`}>
                <span className="time">{it.time}</span> {it.text}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export type FacilityGroupData = {
  id: string;
  variant: string;
  title: string;
  items: { icon: string; text: string }[];
};

/** Dua kolom: "Fasilitas Termasuk" dan "Tidak Termasuk". */
export function FacilitiesGrid({ groups }: { groups: FacilityGroupData[] }) {
  if (groups.length === 0) return null;
  return (
    <div className="fasilitas-grid">
      {groups.map((g) => (
        // Enum FacilityVariant bernilai INCLUDE/EXCLUDE, sedangkan kelas CSS
        // legacy memakai bentuk kecil: .fas-card.include / .fas-card.exclude.
        <div className={`fas-card ${g.variant.toLowerCase()}`} key={g.id}>
          <h3>{g.title}</h3>
          <ul>
            {g.items.map((it, i) => (
              <li key={`${g.id}-${i}`}>
                <span className="fas-icon">{it.icon}</span> {it.text}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
