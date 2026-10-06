"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { feature } from "topojson-client";
import { MeshPhongMaterial } from "three";
import land from "world-atlas/countries-110m.json";
import type { Decision } from "@/lib/types";

export type GlobeTurn = { speaker: string; text: string };

export type GlobeDate = {
  other: string;
  otherName: string;
  kind: "night" | "short";
  turns: GlobeTurn[];
  mine: Decision | null;
  theirs: Decision | null;
  note: string;
};

export type GlobeFit = {
  slug: string;
  name: string;
  decision: Decision;
};

export type GlobePerson = {
  slug: string;
  name: string;
  city: string;
  photo?: string;
  role: string;
  line: string;
  notes: { label: string; body: string }[];
  lat: number | null;
  lng: number | null;
  dates: GlobeDate[];
  fits: GlobeFit[];
};

export type GlobeArc = {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
};

const countries = feature(
  land as unknown as Parameters<typeof feature>[0],
  (land as { objects: { countries: Parameters<typeof feature>[1] } }).objects.countries,
).features as object[];

function label(decision: Decision): string {
  if (decision === "yes") return "Second date";
  if (decision === "never") return "Never";
  return "Not now";
}

export function GlobeStage({ people, arcs }: { people: GlobePerson[]; arcs: GlobeArc[] }) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(560);
  const [selected, setSelected] = useState<string | null>(null);
  const [chatWith, setChatWith] = useState<string | null>(null);
  const pins = useMemo(() => people.filter((person) => person.lat !== null && person.lng !== null), [people]);
  const active = people.find((person) => person.slug === selected) ?? null;
  const chat = active?.dates.find((date) => date.other === chatWith) ?? null;
  const ocean = useMemo(
    () =>
      new MeshPhongMaterial({
        color: "#3aa6ff",
        emissive: "#000000",
        emissiveIntensity: 0,
        shininess: 8,
      }),
    [],
  );

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const watch = new ResizeObserver(() => {
      setSize(Math.max(280, Math.min(box.clientWidth, 640)));
    });
    watch.observe(box);
    return () => watch.disconnect();
  }, []);

  function ready() {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.45;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.addEventListener("start", () => {
      controls.autoRotate = false;
    });
    globe.pointOfView({ lat: 24, lng: -28, altitude: 2.15 });
  }

  const focusRef = useRef<(person: GlobePerson) => void>(() => {});
  function focus(person: GlobePerson) {
    setSelected(person.slug);
    setChatWith(null);
    if (person.lat === null || person.lng === null) return;
    const controls = globeRef.current?.controls();
    if (controls) controls.autoRotate = false;
    globeRef.current?.pointOfView({ lat: person.lat, lng: person.lng, altitude: 1.7 }, 800);
  }
  focusRef.current = focus;

  const pinElement = useCallback((point: object) => {
    const person = point as GlobePerson;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "globe-pin";
    button.dataset.slug = person.slug;
    button.title = person.name;
    button.style.pointerEvents = "auto";
    if (person.photo) {
      const img = document.createElement("img");
      img.src = person.photo;
      img.alt = "";
      button.appendChild(img);
    } else {
      button.textContent = person.name.slice(0, 1);
    }
    button.onclick = (event) => {
      event.stopPropagation();
      focusRef.current(person);
    };
    return button;
  }, []);

  useEffect(() => {
    document.querySelectorAll<HTMLButtonElement>(".globe-pin").forEach((pin) => {
      pin.classList.toggle("on", pin.dataset.slug === selected);
    });
  }, [selected, pins]);

  return (
    <div className={active ? "globe-stage" : "globe-stage solo"}>
      <div className="globe-main">
        <div ref={boxRef} className="globe-canvas">
          <Globe
            ref={globeRef}
            width={size}
            height={size}
            backgroundColor="rgba(0,0,0,0)"
            globeMaterial={ocean}
            showAtmosphere={false}
            polygonsData={countries}
            polygonCapColor={() => "#8ee04a"}
            polygonSideColor={() => "#5fbe32"}
            polygonStrokeColor={() => "rgba(255,255,255,0.15)"}
            polygonAltitude={0.01}
            htmlElementsData={pins}
            htmlLat="lat"
            htmlLng="lng"
            htmlAltitude={0.01}
            htmlElement={pinElement}
            arcsData={arcs}
            arcStartLat="startLat"
            arcStartLng="startLng"
            arcEndLat="endLat"
            arcEndLng="endLng"
            arcColor={() => "#ffb3c7"}
            arcAltitude={0.18}
            arcStroke={0.45}
            onGlobeReady={ready}
          />
        </div>
        <div className="globe-shadow" />
      </div>
      <aside className="globe-card">
        {active && (
          <>
            <button type="button" className="globe-close" onClick={() => { setSelected(null); setChatWith(null); }}>Close</button>
            <div className="globe-card-top">
              {active.photo ? <img src={active.photo} alt="" /> : <span>{active.name.slice(0, 1)}</span>}
              <div>
                <h3>{active.name}</h3>
                <p>{active.city}</p>
              </div>
            </div>
            {chat ? (
              <div className="globe-thread">
                <button type="button" className="globe-back" onClick={() => setChatWith(null)}>Back</button>
                <p className="globe-kicker">{active.name.split(" ")[0]} × {chat.otherName.split(" ")[0]}</p>
                <div className="globe-bubbles">
                  {chat.turns.map((turn, index) => (
                    <p key={`${turn.speaker}-${index}`} className={turn.speaker.startsWith(active.name.split(" ")[0]) ? "me" : "them"}>
                      <span>{turn.speaker}</span>
                      {turn.text}
                    </p>
                  ))}
                </div>
                {chat.mine && (
                  <div className="globe-verdict">
                    <p><span>{active.name.split(" ")[0]}’s agent, after</span>{chat.note}</p>
                    <p className="globe-verdict-row">
                      {active.name.split(" ")[0]}: <strong>{label(chat.mine)}</strong>
                      {chat.theirs && <> · {chat.otherName.split(" ")[0]}: <strong>{label(chat.theirs)}</strong></>}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <>
                {active.role && <p className="globe-line">{active.role}</p>}
                {active.notes.map((note) => (
                  <p key={note.label} className="globe-note"><span>{note.label}</span>{note.body}</p>
                ))}
                {active.dates.length > 0 && (
                  <ul>
                    {active.dates.map((date) => (
                      <li key={date.other}>
                        <button type="button" onClick={() => setChatWith(date.other)}>
                          {active.name.split(" ")[0]} × {date.otherName.split(" ")[0]}
                          <span>{date.mine ? label(date.mine) : date.kind === "night" ? "Second date" : "Date"}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {active.fits.length > 0 && (
                  <ul>
                    {active.fits.map((fit) => (
                      <li key={fit.slug}>
                        <button type="button" onClick={() => {
                          const person = people.find((item) => item.slug === fit.slug);
                          if (person) focus(person);
                        }}>
                          {fit.name}
                          <span>{label(fit.decision)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
