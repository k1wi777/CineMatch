"use client";

import {
  AvatarSchema,
  GeneroSchema,
  PerfilSchema,
  type ActualizarIntereses,
  type ActualizarPerfil,
  type Avatar as RespuestaAvatar,
  type CambiarContrasena,
  type Genero,
  type Perfil,
} from "@cinematch/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { crearClaves, peticion, subirArchivo } from "@/shared/api";

export const claves = crearClaves("perfil");

const CLAVE_PERFIL = claves.detalle("me");
const CLAVE_INTERESES = claves.detalle("intereses");

export function usePerfil() {
  return useQuery<Perfil>({
    queryKey: CLAVE_PERFIL,
    queryFn: () => peticion<Perfil>("/api/users/me", { esquema: PerfilSchema }),
  });
}

export function useActualizarPerfil() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (cambios: ActualizarPerfil) =>
      peticion<Perfil>("/api/users/me", {
        metodo: "PATCH",
        cuerpo: cambios,
        esquema: PerfilSchema,
      }),
    onSuccess: (perfil) => cliente.setQueryData(CLAVE_PERFIL, perfil),
  });
}

export function useIntereses() {
  return useQuery<Genero[]>({
    queryKey: CLAVE_INTERESES,
    queryFn: () =>
      peticion<Genero[]>("/api/users/me/interests", { esquema: z.array(GeneroSchema) }),
  });
}

export function useReemplazarIntereses() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (datos: ActualizarIntereses) =>
      peticion<Genero[]>("/api/users/me/interests", {
        metodo: "PUT",
        cuerpo: datos,
        esquema: z.array(GeneroSchema),
      }),
    onSuccess: (generos) => cliente.setQueryData(CLAVE_INTERESES, generos),
  });
}

export function useCambiarContrasena() {
  return useMutation({
    mutationFn: (datos: CambiarContrasena) =>
      peticion<void>("/api/users/me/password", { metodo: "PUT", cuerpo: datos }),
  });
}

export function useSubirAvatar() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({
      archivo,
      onProgreso,
    }: {
      archivo: File;
      onProgreso: (porcentaje: number) => void;
    }) => {
      const datos = new FormData();
      datos.append("avatar", archivo);
      return subirArchivo<RespuestaAvatar>("/api/users/me/avatar", datos, {
        onProgreso,
        esquema: AvatarSchema,
      });
    },
    onSuccess: (avatar) =>
      cliente.setQueryData<Perfil>(CLAVE_PERFIL, (actual) =>
        actual ? { ...actual, avatarUrl: avatar.avatarUrl } : actual,
      ),
  });
}

export function useQuitarAvatar() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: () => peticion<void>("/api/users/me/avatar", { metodo: "DELETE" }),
    onSuccess: () =>
      cliente.setQueryData<Perfil>(CLAVE_PERFIL, (actual) =>
        actual ? { ...actual, avatarUrl: null } : actual,
      ),
  });
}
