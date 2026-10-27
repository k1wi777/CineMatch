import type { ContenidoExterno } from "./movie-provider.js";

// Catálogo de prueba: títulos ficticios con datos estables. Sirve para trabajar y testear sin clave de TMDB.
// No representa obras reales; los ids y los nombres son inventados.
const FIXTURES_BASE: ContenidoExterno[] = [
  {
    tipo: "pelicula",
    idExterno: "900001",
    titulo: "Atardecer en Marte de prueba",
    sinopsis: "Una expedición queda varada y tiene que decidir qué llevar de vuelta.",
    anio: 2019,
    director: "Director Ficticio A",
    duracion: 118,
    posterUrl: null,
    popularidadExterna: 96.4,
    generos: ["Ciencia ficción", "Drama"],
  },
  {
    tipo: "pelicula",
    idExterno: "900002",
    titulo: "Risas en el puerto de prueba",
    sinopsis: "Dos hermanos abren un restaurante que nadie quiere visitar.",
    anio: 2021,
    director: "Director Ficticio B",
    duracion: 97,
    posterUrl: null,
    popularidadExterna: 81.2,
    generos: ["Comedia"],
  },
  {
    tipo: "pelicula",
    idExterno: "900003",
    titulo: "Persecución nocturna de prueba",
    sinopsis: "Una conductora de carreras cruza la ciudad para salvar a su equipo.",
    anio: 2022,
    director: "Director Ficticio C",
    duracion: 105,
    posterUrl: null,
    popularidadExterna: 77.9,
    generos: ["Acción", "Suspense"],
  },
  {
    tipo: "pelicula",
    idExterno: "900004",
    titulo: "Casa silenciosa de prueba",
    sinopsis: "Una familia descubre que la casa de campo guarda un secreto.",
    anio: 2020,
    director: "Director Ficticio D",
    duracion: 92,
    posterUrl: null,
    popularidadExterna: 64.0,
    generos: ["Terror"],
  },
  {
    tipo: "pelicula",
    idExterno: "900005",
    titulo: "Bosque animado de prueba",
    sinopsis: "Un zorro aprende a volar con la ayuda de los pájaros del valle.",
    anio: 2018,
    director: "Director Ficticio E",
    duracion: 85,
    posterUrl: null,
    popularidadExterna: 58.7,
    generos: ["Animación", "Familia"],
  },
  {
    tipo: "pelicula",
    idExterno: "900006",
    titulo: "Lluvia sobre la ciudad de prueba",
    sinopsis: "Un detective sigue una pista que lleva a su propio pasado.",
    anio: 2017,
    director: "Director Ficticio F",
    duracion: 112,
    posterUrl: null,
    popularidadExterna: 49.3,
    generos: ["Drama", "Misterio"],
  },
  {
    tipo: "serie",
    idExterno: "800001",
    titulo: "Estación orbital de prueba",
    sinopsis: "La tripulación de una estación descubre una señal desde la Tierra.",
    anio: 2020,
    director: "Creador Ficticio A",
    duracion: 48,
    posterUrl: null,
    popularidadExterna: 102.5,
    generos: ["Ciencia ficción", "Aventura"],
  },
  {
    tipo: "serie",
    idExterno: "800002",
    titulo: "Oficina caótica de prueba",
    sinopsis: "Un equipo intenta entregar un proyecto imposible en una semana.",
    anio: 2019,
    director: "Creador Ficticio B",
    duracion: 25,
    posterUrl: null,
    popularidadExterna: 88.1,
    generos: ["Comedia"],
  },
  {
    tipo: "serie",
    idExterno: "800003",
    titulo: "Reino de prueba",
    sinopsis: "Dos casas rivales se disputan un trono en un reino ficticio.",
    anio: 2022,
    director: "Creador Ficticio C",
    duracion: 60,
    posterUrl: null,
    popularidadExterna: 95.0,
    generos: ["Drama", "Fantasía"],
  },
  {
    tipo: "serie",
    idExterno: "800004",
    titulo: "Sótano de prueba",
    sinopsis: "Un grupo de amigos investiga desapariciones en su barrio.",
    anio: 2021,
    director: "Creador Ficticio D",
    duracion: 52,
    posterUrl: null,
    popularidadExterna: 71.6,
    generos: ["Terror", "Misterio"],
  },
  {
    tipo: "serie",
    idExterno: "800005",
    titulo: "Pequeños monstruos de prueba",
    sinopsis: "Criaturas adorables viven escondidas en una escuela primaria.",
    anio: 2023,
    director: "Creador Ficticio E",
    duracion: 22,
    posterUrl: null,
    popularidadExterna: 60.2,
    generos: ["Animación", "Comedia"],
  },
  {
    tipo: "serie",
    idExterno: "800006",
    titulo: "Frontera de prueba",
    sinopsis: "Agentes de una frontera imaginaria cruzan en busca de un contacto.",
    anio: 2018,
    director: "Creador Ficticio F",
    duracion: 55,
    posterUrl: null,
    popularidadExterna: 44.8,
    generos: ["Acción", "Drama"],
  },
];

const GENEROS_GENERADOS = [
  "Acción",
  "Drama",
  "Comedia",
  "Ciencia ficción",
  "Terror",
  "Animación",
  "Misterio",
  "Suspense",
  "Romance",
  "Aventura",
];

// Títulos generados para cargar catálogos de prueba del tamaño que pide el seed (BE-6.3).
// Ids y nombres son sintéticos; cada posición produce siempre el mismo título.
function generarFixtures(tipo: "pelicula" | "serie", cantidad: number): ContenidoExterno[] {
  const base = tipo === "pelicula" ? 910_000 : 810_000;
  const etiqueta = tipo === "pelicula" ? "Película generada" : "Serie generada";
  return Array.from({ length: cantidad }, (_, i) => {
    const primero = GENEROS_GENERADOS[i % GENEROS_GENERADOS.length] ?? "Drama";
    const segundo = GENEROS_GENERADOS[(i * 3 + 1) % GENEROS_GENERADOS.length] ?? "Comedia";
    return {
      tipo,
      idExterno: String(base + i + 1),
      titulo: `${etiqueta} ${i + 1}`,
      sinopsis: "Título sintético para pruebas del catálogo.",
      anio: 1990 + (i % 35),
      director: `Director generado ${i + 1}`,
      duracion: 60 + (i % 90),
      posterUrl: null,
      popularidadExterna: 50 - i / 100,
      generos: primero === segundo ? [primero] : [primero, segundo],
    };
  });
}

// Catálogo de prueba completo: los títulos base más 500 películas y 500 series generadas.
export const FIXTURES_MOCK: ContenidoExterno[] = [
  ...FIXTURES_BASE,
  ...generarFixtures("pelicula", 500),
  ...generarFixtures("serie", 500),
];
