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
let apiYoutube: Promise<boolean> | undefined;
// Resuelve a true cuando la API está lista y a false si el script no carga (p. ej. un bloqueador lo corta).
// Un fallo no se guarda: la siguiente vez se vuelve a intentar.
function cargarApiYoutube(): Promise<boolean> {
  if ((window as unknown as { YT?: ApiYT }).YT?.Player) return Promise.resolve(true);
  apiYoutube ??= new Promise<boolean>((resolver) => {
    const ventana = window as unknown as { onYouTubeIframeAPIReady?: () => void };
    const previa = ventana.onYouTubeIframeAPIReady;
    ventana.onYouTubeIframeAPIReady = () => {
      previa?.();
      resolver(true);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
      script.remove();
      apiYoutube = undefined;
      resolver(false);
    };
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
      // 133 % del tamaño que cubre el contenedor: así los videos 4:3 también llenan el fondo sin barras negras.
      "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:max(133.33cqw,237.04cqh);height:max(133.33cqh,75cqw);pointer-events:none";
    const nodo = document.createElement("div");
    nodo.style.cssText = "width:100%;height:100%";
    caja.appendChild(nodo);
    host.appendChild(caja);

    let jugador: JugadorYT | undefined;
    let cancelado = false;
    cargarApiYoutube().then((lista) => {
      const yt = (window as unknown as { YT?: ApiYT }).YT;
      if (cancelado) return;
      // Sin la API no hay reproductor: se da el video por terminado (no se marca como no disponible).
      if (!lista || !yt) {
        avisos.current.alTerminar();
        return;
      }
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
