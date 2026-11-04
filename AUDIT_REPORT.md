# Auditoría integral de AuraMaster

Fecha: 2026-11-03  
Alcance: landing, autenticación, estudio, administración, facturación, configuración pública, seguridad de dependencias y mantenibilidad.

## Puntuación actual: 84/100

| Área | Nota | Evidencia |
| --- | ---: | --- |
| UX, identidad y responsive | 18/20 | Sistema visual consistente, landing completa, A/B real, vista del producto, carga por clic y drag & drop. |
| Producto y masterización | 17/20 | Flujo individual, stems, bulk, reportes, exportación, referencia y controles DSP. Falta una suite automatizada de audio de referencia. |
| Autenticación y seguridad | 17/20 | Google OAuth real, tokens firmados con HMAC, API keys cifradas AES-256-GCM, endpoints admin protegidos y 0 vulnerabilidades npm conocidas. Los tokens siguen en localStorage y no existe revocación server-side. |
| Planes, pagos y administración | 18/20 | Bold server-side, webhook firmado, owner bypass, precios/descuentos persistentes, landing sincronizada y nueva info bar. Falta historial de transacciones en el dashboard. |
| Rendimiento, arquitectura y pruebas | 14/20 | Build correcto y TypeScript activo. El bundle JS inicial ronda 874 KB, `App.tsx` supera 92 KB y no hay pruebas automatizadas del producto. |

## Cambios realizados durante la auditoría

- Owner Dashboard dividido en `Plans & Billing` e `Info bar`.
- Edición persistente de moneda, costo cobrado, precio visible, descuento y disponibilidad por plan.
- Info bar configurable: estado, mensaje, tono, enlace y vista previa.
- Endpoint público `/api/site-config` con sólo datos seguros.
- Landing conectada a precios, descuentos, disponibilidad y cupo gratuito reales del servidor.
- Info bar renderizada tanto en la landing como en el estudio.
- Cierre de sesión endurecido: limpia sesión y vuelve a `/`.
- Verificación visual: AuraMaster ofrece únicamente Google OAuth; no contiene formulario email/contraseña.
- Vite actualizado de 6.4.3 a 6.4.5 y `source-map-js` a 1.2.2.
- `npm audit`: 0 vulnerabilidades conocidas.

## Hallazgos importantes

### 1. La captura de login no pertenece a AuraMaster

El modal adjunto muestra explícitamente “Acceso a ReadyToPrint”. No se origina en el código ni en el dominio de AuraMaster. La pantalla de acceso de AuraMaster fue verificada y presenta un único botón: `Continuar con Google`.

### 2. Configuración comercial antes duplicada

El checkout ya consultaba la configuración persistida del servidor, pero la landing mostraba precios escritos a mano. Esto podía producir diferencias entre marketing y cobro. La landing ahora consume `/api/site-config`.

### 3. Cierre de sesión dependía del estado reactivo

Antes, cerrar sesión limpiaba localStorage y esperaba que la suscripción React cambiara la vista. Ahora también navega explícitamente a `/`, por lo que el resultado es determinista.

### 4. Deuda técnica principal

- No existen archivos `*.test.*` o `*.spec.*` propios del proyecto.
- `App.tsx` concentra demasiadas responsabilidades.
- El bundle inicial supera el umbral recomendado de 500 KB.
- Los tokens firmados duran siete días y no hay lista de revocación server-side.
- Los modales necesitan una revisión específica de focus trap y navegación completa por teclado.

## Próximas mejoras recomendadas

1. Añadir pruebas E2E para login/logout, cambios de plan, info bar, checkout y carga de archivos.
2. Crear pruebas de regresión de audio con canciones de referencia y métricas toleradas.
3. Dividir `App.tsx` en dominios: sesión, proyecto de audio, bulk, stems, exportación y overlays.
4. Aplicar `React.lazy` a modales y módulos de análisis para reducir el bundle inicial.
5. Añadir historial de pagos y eventos Bold al Owner Dashboard.
6. Migrar la sesión a cookie `HttpOnly` o implementar revocación de tokens.
7. Completar auditoría WCAG 2.2 AA con foco en modales, contraste y teclado.

## Verificaciones ejecutadas

- `npm run build`: aprobado.
- `tsc --noEmit`: aprobado.
- `npm audit --omit=dev`: 0 vulnerabilidades.
- `/api/site-config`: responde con configuración pública normalizada.
- Login visual: sólo Google OAuth, sin email/contraseña.
- Búsqueda de secretos incrustados: sin coincidencias en código versionado.
