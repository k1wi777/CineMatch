"use client";

import { useEffect, useRef } from "react";
import { claveYoutube } from "@/features/catalogo/trailer-logica";

// Tipos mínimos de la API de YouTube que usamos.
type JugadorYT = { destroy: () => void };
type ApiYT = {
  Player: new (
    elemento: HTMLElement,
    opciones: {
      videoId: string;
      width?: string;
      height?: string;
      playerVars: Record<string, number | string>;
      events: {
        onStateChange?: (evento: { data: number }) => void;
        onError?: () => void;
      };
    },
  ) => JugadorYT;
  PlayerState: { ENDED: number };
};

// La API de YouTube se carga una sola vez, cuando hace falta el primer video.
let apiYoutube: Promise<void> | undefined;
function cargarApiYoutube(): Promise<void> {
  if ((window as unknown as { YT?: ApiYT }).YT?.Player) return Promise.resolve();
  apiYoutube ??= new Promise<void>((resolver) => {
    const ventana = window as unknown as { onYouTubeIframeAPIReady?: () => void };
    const previa = ventana.onYouTubeIframeAPIReady;
    ventana.onYouTubeIframeAPIReady = () => {
      previa?.();
      resolver();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiYoutube;
}

// Video de fondo: sin sonido y sin controles, cubre todo su contenedor (que debe ser relativo) y avisa cuando
// termina o si no se puede reproducir. Las capas que van encima se colocan después en el DOM.
export function VideoFondo({
  url,
  alTerminar,
  alNoHayTrailer,
}: {
  url: string | null;
  alTerminar: () => void;
  alNoHayTrailer: () => void;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const avisos = useRef({ alTerminar, alNoHayTrailer });

  useEffect(() => {
    avisos.current = { alTerminar, alNoHayTrailer };
  });

  useEffect(() => {
    const clave = url ? claveYoutube(url) : null;
    const host = contenedor.current;
    if (!clave || !host) {
      avisos.current.alNoHayTrailer();
      return;
    }

    // Caja del tamaño que cubre el contenedor (proporción 16:9, recortada en el centro).
    const caja = document.createElement("div");
    caja.style.cssText =
      "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:max(100cqw,177.78cqh);height:max(100cqh,56.25cqw);pointer-events:none";
    const nodo = document.createElement("div");
    nodo.style.cssText = "width:100%;height:100%";
    caja.appendChild(nodo);
    host.appendChild(caja);

    let jugador: JugadorYT | undefined;
    let cancelado = false;
    cargarApiYoutube().then(() => {
      const yt = (window as unknown as { YT?: ApiYT }).YT;
      if (cancelado || !yt) return;
      jugador = new yt.Player(nodo, {
        videoId: clave,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          origin: window.location.origin,
        },
        events: {
          onStateChange: (evento) => {
            if (evento.data === yt.PlayerState.ENDED) avisos.current.alTerminar();
          },
          onError: () => avisos.current.alNoHayTrailer(),
        },
      });
    });

    return () => {
      cancelado = true;
      jugador?.destroy();
      caja.remove();
    };
  }, [url]);

  return (
    <div
      ref={contenedor}
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden"
      style={{ containerType: "size" }}
    />
  );
}
