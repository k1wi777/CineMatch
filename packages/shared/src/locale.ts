import { z } from "zod";
import { es } from "zod/locales";

// Mensajes de validación por defecto de Zod en español (API y web). Se aplica al cargar el paquete compartido.
z.config(es());
