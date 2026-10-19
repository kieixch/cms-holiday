"use client";

/* eslint-disable @next/next/no-img-element */
// Halaman link-bio memakai <img> biasa: logo & galeri ukurannya dinamis dan
// tanpa rasio tetap (masonry), sedangkan optimasi next/image tidak dibutuhkan
// untuk satu halaman berdiri sendiri ini.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import {
  formatRupiah,
  packageMinPrice,
  waHref,
  type BioLinkPageData,
  type BioPackage,
} from "@/lib/bio";
import { waButtonHref } from "@/lib/wa";
import { BACK_HOME_BUTTON_HTML } from "@/lib/halaman-back-button";

/** Render prop yang dipakai pratinjau admin untuk membuka group field. */
export type BioSectionWrap = (id: string, node: ReactNode) => ReactNode;

function WaIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.8 14.15c-.24.68-1.42 1.3-1.95 1.34-.5.05-.98.23-3.3-.69-2.78-1.1-4.55-3.94-4.69-4.13-.14-.19-1.13-1.5-1.13-2.87 0-1.36.71-2.03.97-2.31.24-.27.53-.34.71-.34l.51.01c.16.01.39-.06.6.46.24.58.8 2 .87 2.14.07.15.12.32.02.51-.1.19-.15.31-.29.48-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.29.75 1.24 1.61 2.01 1.11.99 2.04 1.29 2.33 1.44.29.15.46.12.63-.07.17-.19.73-.85.93-1.15.19-.29.39-.24.65-.14.27.09 1.69.8 1.98.94.29.15.48.22.55.34.07.12.07.7-.17 1.38z" />
    </svg>
  );
}

const SCHEDULE_CLASS: Record<string, string> = {
  weekend: " wknd",
  weekday: " wkdy",
};

export function BioLinkPage({
  data,
  section,
}: {
  data: BioLinkPageData;
  section?: BioSectionWrap;
}) {
  const wrap: BioSectionWrap = section ?? ((_, node) => node);
  const [active, setActive] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);

  const close = useCallback(() => {
    setShown(false);
    window.setTimeout(() => {
      setMounted(false);
      setActive(null);
      document.body.style.overflow = "";
    }, 260);
  }, []);

  const open = useCallback((index: number) => {
    setActive(index);
    setMounted(true);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => setShown(true));
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mounted, close]);

  const pkg = active !== null ? data.packages[active] : null;

  return (
    <>
      <div className="hbgl-bio">
        <div
          className="hbgl-bio__back"
          dangerouslySetInnerHTML={{ __html: BACK_HOME_BUTTON_HTML }}
        />
        <div className="hb-wrap">
          {wrap(
            "hero",
            <div className="hb-hero">
              {data.logo ? (
                <img className="hb-logo" src={data.logo} alt={data.logoAlt || data.brand} />
              ) : null}
              <div className="hb-brand">{data.brand}</div>
              {data.tag ? <div className="hb-tag">{data.tag}</div> : null}
              {data.subtitle ? <p className="hb-sub">{data.subtitle}</p> : null}
              {data.chips.length ? (
                <div className="hb-chips">
                  {data.chips.map((chip, index) => (
                    <span className="hb-chip" key={index}>
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null}
              <a
                className="hb-wabar"
                target="_blank"
                rel="noopener"
                href={waButtonHref(data.waLink, data.waNumber, data.waMessageTop)}
              >
                <WaIcon />
                <span>{data.waLabel}</span>
              </a>
              {data.waHint ? <p className="hb-wahint">{data.waHint}</p> : null}
            </div>,
          )}

          {data.openTrips.length ? (
            <>
              <div className="hb-sect">
                <span>{data.openTripLabel}</span>
              </div>
              {wrap(
                "openTrip",
                <div className="hb-open">
                  {data.openTrips.map((trip, index) => (
                    <a
                      className="hb-row"
                      key={index}
                      target="_blank"
                      rel="noopener"
                      href={waHref(
                        data.waNumber,
                        `${data.waGreeting} Holiday Banyuwangi, saya mau tanya Open Trip ${trip.name} (${trip.schedule})`,
                      )}
                    >
                      <span className="hb-rnum">{index + 1}</span>
                      <span className="hb-rbody">
                        <span className="hb-rname">{trip.name}</span>
                        <br />
                        <span className={`hb-rjad${SCHEDULE_CLASS[trip.schedule] ?? ""}`}>
                          {trip.schedule}
                        </span>
                      </span>
                      <span className="hb-rprice">
                        <b>{formatRupiah(trip.price)}</b>
                        <small>/pax</small>
                      </span>
                      <span className="hb-rgo">
                        <WaIcon />
                      </span>
                    </a>
                  ))}
                  {data.openTripNote ? (
                    <div className="hb-opennote">{data.openTripNote}</div>
                  ) : null}
                </div>,
              )}
            </>
          ) : null}

          {data.packages.length ? (
            <>
              <div className="hb-sect">
                <span>{data.privateTripLabel}</span>
              </div>
              {wrap(
                "privateTrip",
                <div>
                  {data.packages.map((item, index) => (
                    <button
                      type="button"
                      className="hb-card"
                      key={index}
                      onClick={() => open(index)}
                    >
                      <div className="hb-top">
                        <div className="hb-ico">
                          {item.image ? (
                            <img loading="lazy" src={item.image} alt="" />
                          ) : item.emoji}
                        </div>
                        <div className="hb-body">
                          <div className="hb-name">
                            {item.name}
                            {item.badge ? (
                              <span className={`hb-badge${item.badgeAlt ? " alt" : ""}`}>
                                {item.badge}
                              </span>
                            ) : null}
                          </div>
                          <div className="hb-desc">{item.desc}</div>
                        </div>
                      </div>
                      <div className="hb-foot">
                        <div className="hb-price">
                          <small>Mulai dari</small>
                          <b>
                            {formatRupiah(packageMinPrice(item))} <i>/pax</i>
                          </b>
                        </div>
                        <span className="hb-see">Lihat detail</span>
                      </div>
                    </button>
                  ))}
                </div>,
              )}
            </>
          ) : null}

          {data.gallery.length ? (
            <>
              <div className="hb-sect">
                <span>{data.galleryLabel}</span>
              </div>
              {wrap(
                "gallery",
                <div className="hb-gal">
                  {data.gallery.map((image, index) => (
                    <figure key={index}>
                      <img loading="lazy" src={image.url} alt={image.alt} />
                    </figure>
                  ))}
                </div>,
              )}
            </>
          ) : null}

          {data.ctaTitle || data.ctaText ? (
            wrap(
              "cta",
              <a
                className="hb-cta"
                target="_blank"
                rel="noopener"
                href={waHref(data.waNumber, data.ctaMessage)}
              >
                <h3>{data.ctaTitle}</h3>
                <p>{data.ctaText}</p>
                <span>
                  <WaIcon />
                  {data.ctaLabel}
                </span>
              </a>,
            )
          ) : null}

          {wrap(
            "footer",
            <div className="hb-end">
              <p>{data.footerText}</p>
              {data.footerLegal ? <div className="hb-legal">{data.footerLegal}</div> : null}
            </div>,
          )}
        </div>
      </div>

      {mounted && pkg
        ? createPortal(
            <div
              className={`hbgl-bioportal on${shown ? " show" : ""}`}
              role="dialog"
              aria-modal="true"
              aria-label={pkg.name}
            >
              <div className="hb-backdrop" onClick={close} />
              <div className="hb-sheet">
                <div className="hb-mhead">
                  <div className="hb-grab" />
                  <button className="hb-close" type="button" onClick={close} aria-label="Tutup">
                    ✕
                  </button>
                  <div className="hb-mtitle">{pkg.name}</div>
                  {pkg.meta.length ? (
                    <div className="hb-mmeta">
                      {pkg.meta.map((meta, index) => (
                        <i key={index}>{meta}</i>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="hb-mbody">
                  {pkg.itinerary.length ? (
                    <>
                      <div className="hb-h">Itinerary</div>
                      {pkg.itinerary.map((day, dayIndex) => (
                        <div key={dayIndex}>
                          {day.day ? <div className="hb-day">{day.day}</div> : null}
                          <ul className="hb-steps">
                            {day.steps.map((step, stepIndex) => (
                              <li key={stepIndex}>
                                <b>{step.time}</b> {step.text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </>
                  ) : null}

                  {pkg.priceColumns.length ? (
                    <>
                      <div className="hb-h">Harga per orang</div>
                      <table className="hb-tbl">
                        <thead>
                          <tr>
                            <th>Peserta</th>
                            {pkg.priceColumns.map((column) => (
                              <th key={column.key}>{column.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pkg.prices.map((row, index) => (
                            <tr key={index}>
                              <td>{row.pax} pax</td>
                              {pkg.priceColumns.map((column) => (
                                <td key={column.key}>
                                  {formatRupiah(row.values[column.key] ?? "")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="hb-note">
                        Harga sudah termasuk fasilitas di bawah. Semakin ramai, semakin murah per
                        orangnya.
                        {pkg.note ? `\n${pkg.note}` : ""}
                      </p>
                    </>
                  ) : null}

                  {pkg.includes.length ? (
                    <>
                      <div className="hb-h">Sudah termasuk</div>
                      <ul className="hb-list inc">
                        {pkg.includes.map((text, index) => (
                          <li key={index}>{text}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}

                  {pkg.excludes.length ? (
                    <>
                      <div className="hb-h">Belum termasuk</div>
                      <ul className="hb-list exc">
                        {pkg.excludes.map((text, index) => (
                          <li key={index}>{text}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
                <div className="hb-mfoot">
                  <div className="p">
                    <small>Mulai dari</small>
                    <b>{formatRupiah(packageMinPrice(pkg))}</b>
                  </div>
                  <a
                    className="hb-wa"
                    target="_blank"
                    rel="noopener"
                    href={waHref(
                      data.waNumber,
                      `${data.waGreeting} Holiday Banyuwangi, saya mau tanya ${pkg.name}`,
                    )}
                  >
                    <WaIcon />
                    Pesan
                  </a>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export type { BioLinkPageData, BioPackage };
