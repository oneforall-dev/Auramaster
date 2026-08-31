# 🎛️ AuraMaster AI 4.0 — Neural Audio Mastering Workstation

<div align="center">

![AuraMaster Banner](https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200&auto=format&fit=crop&q=80)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Web Audio API](https://img.shields.io/badge/Web_Audio_API-64--bit_DSP-FF5722)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Encryption](https://img.shields.io/badge/Security-AES--256--GCM-10B981)](https://nodejs.org/api/crypto.html)
[![OAuth](https://img.shields.io/badge/Auth-Google_OAuth_2.0-4285F4?logo=google)](https://developers.google.com/identity)

**Estación de Trabajo de Audio Digital (DAW) y Masterización Neuronal en el Navegador con Cifrado de Grado Militar y Asistente Multi-IA.**

[Demostración en Vivo](#-instalaci%C3%B3n-y-ejecuci%C3%B3n) • [Características](#-caracter%C3%ADsticas-principales) • [Arquitectura de Seguridad](#-arquitectura-de-seguridad-y-cifrado-vps) • [Despliegue en VPS](#-despliegue-en-producci%C3%B3n-vps)

</div>

---

## 🌟 Descripción General

**AuraMaster AI 4.0** es un DAW profesional de masterización y mezcla de audio basado en navegador que combina el procesamiento de señales digitales (DSP de 32/64 bits en punto flotante) con modelos avanzados de Inteligencia Artificial (**Google Gemini 2.5, OpenAI GPT-4o, Groq Llama 3 y Anthropic Claude**).

Diseñado para productores, ingenieros de mezcla y creadores de música con IA (Suno, Udio, Stable Audio), AuraMaster ofrece masterización de precisión comercial (estándar EBU R128 / Spotify `-14 LUFS` y `-1.0 dB True Peak`), aislamiento criptográfico de credenciales en VPS y análisis espectral en tiempo real a 60 FPS.

---

## 🚀 Características Principales

### 🎛️ 1. Motor DSP de Masterización Profesional (Web Audio 64-bit)
* **Ecualizador Paramétrico Lineal de 5 Bandas:** Control interactivo de curvas por nodo (Low, Low-Mid, Mid, High-Mid, High) con ajuste de Q y ganancia en tiempo real sobre lienzo visual.
* **Compresor Multibanda de 3 Vías:** Divisores de frecuencia (Crossovers) configurables con modelado de dinámicas (Threshold, Ratio, Attack, Release).
* **Transient Shaper:** Control dinámico de ataque (*Punch*) y sostenimiento (*Sustain*) para realzar baterías y pegada general.
* **Limitador Brickwall True-Peak:** Techo estricto a `-1.0 dBTP` con codo suave (*Soft Knee*) y compensación de ganancia inteligente para prevenir clipping inter-muestra.
* **Procesador Estéreo:** Apertura de imagen estéreo (M/S) y verificación de correlación/monocompatibilidad.
* **Rack de Efectos Analógicos y Ambientales:**
  * Saturación a cinta (*Tape Saturation*) y distorsión armónica a válvulas (*Tube*).
  * Decimador Lo-Fi (Bit Depth y Sample Rate reduction).
  * Reverb por Convolución estéreo y Delay estéreo con retroalimentación.
  * Puerta de Ruido (*Noise Gate*) con detección de piso de ruido automática y De-Esser dinámico.

---

### 🤖 2. Asistente Neuronal de Masterización (Multi-IA)
* **Prompting en Lenguaje Natural:** Solicita ajustes descriptivos como *"Quiero un sonido acústico cálido con bajos definidos"* o *"Maximiza el volumen para Trap pesado con pegada en 808"*.
* **Presets de Género Instantáneos:** Pop, Hip-Hop, Electronic, Trap, Rock, Metal, Jazz, Acoustic, Natural y Universal.
* **Mixer Fixer & Auto-Balance:** Análisis espectral estéreo inteligente y corrección automática de desbalances de mezcla.
* **Informe Diagnóstico de Masterización:** Ventana modal con desglose detallado de sugerencias de EQ, balance dinámico y métricas LUFS.

---

### 🛡️ 3. Arquitectura de Seguridad y Cifrado VPS
* **Envelope Encryption AES-256-GCM:** Cifrado por capas con clave maestra en servidor y derivación por usuario mediante PBKDF2 (SHA-512, 100,000 iteraciones).
* **Proxy Seguro de IA en Servidor:** Las API Keys del usuario nunca viajan al navegador del cliente ni se exponen en JavaScript. Se descifran únicamente en la memoria RAM volátil del servidor durante la petición HTTPS y se liberan de inmediato.
* **Autenticación con Google OAuth 2.0:** Acceso oficial mediante Google Identity Services (`/auth/google/callback`) con verificación criptográfica de ID Tokens JWT.
* **Registro y Auditoría de Correos en VPS:** Almacenamiento seguro de usuarios registrados y exportación en hoja de cálculo ([`.data/users_registry.csv`](.data/users_registry.csv) y `.data/users.json`).
* **Privacidad Efímera Garantizada:** **Ningún audio ni proyecto se almacena en el disco del servidor.** Todo el procesamiento DSP se ejecuta en la RAM del navegador del cliente.

---

### 📊 4. Medición y Visualización a 60 FPS
* **Medición EBU R128:** Cálculo de LUFS Integrado, LUFS Short-Term y True Peak en decibelios (dBTP).
* **3 Modos de Visualización:**
  1. **Waveform Interactivo:** Zoom horizontal adaptativo con scroll automático y navegación por arrastre (*Drag*).
  2. **Analizador de Espectro FFT:** Respuesta de frecuencias en tiempo real (20 Hz - 20 kHz).
  3. **Vectorscopio / Goniómetro de Lissajous:** Análisis de fase estéreo y correlación.
* **Edición No Destructiva con Deshacer (`Ctrl + Z`):** Selección de fragmentos de audio para balance de ganancia y reversión de cambios en 1 clic.

---

### 📦 5. Masterización por Lotes y Exportación Comercial
* **Modo Stems y Modo Álbum (Bulk):** Carga múltiples pistas o stems independientes, aplica cadenas individuales o maestras y procesa por lote.
* **Exportación en Calidad Broadcast (24-bit WAV):** Renderizado de alta fidelidad sin pérdida de calidad.
* **Descarga en Lote en ZIP:** Empaqueta todas las canciones masterizadas en un único archivo comprimido.
* **Pantalla Post-Descarga & Enlace a Chart Melodia:**
  * Confirmación de masterización con estándares de Spotify (`-14 LUFS`).
  * Integración con la comunidad de música IA para subir pistas a [chart.melodia.top](https://chart.melodia.top).

---

### 🌐 6. Soporte Multi-idioma (i18n)
* 🇪🇸 **Español**
* 🇺🇸 **English**
* 🇰🇷 **한국어 (Korean)**
* 🇯🇵 **日本語 (Japanese)**

---

## 📁 Estructura del Proyecto

```
auramaster-ai---mix-4.0/
├── components/                 # Componentes visuales y módulos de la interfaz
│   ├── AIMasteringReportModal.tsx  # Diagnóstico y reporte de masterización IA
│   ├── AISettingsModal.tsx         # Gestión del Baúl de API Keys (AES-256)
│   ├── Assistant.tsx               # Asistente colapsable de IA con selector de modelos
│   ├── AuthGate.tsx                # Pantalla previa de autenticación Google OAuth
│   ├── EffectRack.tsx              # Rack de perillas, EQ visual y módulos DSP
│   ├── ExportSuccessModal.tsx      # Confirmación de descarga e invitación a Chart Melodia
│   ├── FilesBox.tsx                # Gestor de pistas, stems y masterización por lotes
│   ├── GoogleAuthButton.tsx        # Botón y menú de perfil Google OAuth 2.0
│   ├── Knob.tsx                    # Perilla táctil rotatoria estilo hardware de estudio
│   ├── MeterBar.tsx                # Medidor de niveles LUFS y True-Peak en tiempo real
│   ├── TimelineBar.tsx             # Línea de tiempo adaptativa a la duración real
│   ├── VisualEQ.tsx                # Ecualizador visual interactivo de 5 bandas
│   └── Visualizer.tsx              # Canvas de onda, analizador FFT y vectorscopio
├── server/                     # Backend seguro del VPS (Node.js / Express / Vite Plugin)
│   ├── aiProxy.ts                  # Proxy HTTPS seguro para Gemini, OpenAI, Groq y Anthropic
│   ├── apiRouter.ts                # Enrutador REST (/api/auth, /api/ai, /api/admin)
│   ├── crypto.ts                   # Motor criptográfico AES-256-GCM y PBKDF2
│   ├── googleAuth.ts               # Verificación de tokens OAuth 2.0 con Google
│   ├── server.js                   # Servidor autónomo de producción para VPS
│   ├── storage.ts                  # Baúl cifrado y registro de usuarios en CSV
│   └── vitePlugin.ts               # Middleware para desarrollo y previsualización Vite
├── services/                   # Servicios del cliente y motor de audio
│   ├── audioEngine.ts              # Motor 64-bit Web Audio API, DSP y renderizado
│   ├── aiService.ts                # Conector cliente al proxy seguro del VPS
│   ├── authService.ts              # Manejador de estado de sesión y Google OAuth
│   ├── exportZip.ts                # Generador de archivos ZIP para exportación por lotes
│   └── i18n.ts                     # Diccionario de traducción multi-idioma
├── .data/                      # Base de datos local del VPS (ignorado en git)
│   ├── users_registry.csv          # Registro en hoja de cálculo de correos y accesos
│   ├── users.json                  # Base de datos JSON de perfiles
│   └── user_vault.enc.json         # Baúl cifrado AES-256-GCM con claves aisladas
├── .env.example                # Plantilla de variables de entorno
├── App.tsx                     # Componente principal del DAW
├── index.html                  # Plantilla HTML con SDK de Google Identity Services
├── package.json                # Dependencias del proyecto
└── vite.config.ts              # Configuración de Vite y plugins de seguridad
```

---

## ⚙️ Instalación y Ejecución Local

### Prerrequisitos
* **Node.js** v18.0 o superior
* **npm** o **bun**

### 1. Clonar el Repositorio
```bash
git clone https://github.com/oneforall-dev/Auramaster.git
cd Auramaster
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno
Copia el archivo de ejemplo y configura tus claves:
```bash
cp .env.example .env
```

Edita `.env`:
```env
# Google OAuth 2.0 Client ID & Secret (Desde Google Cloud Console)
GOOGLE_CLIENT_ID=tu_cliente_id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=tu_cliente_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_cliente_secret

# Clave Maestra del Servidor para Cifrado AES-256-GCM (32 caracteres o más)
ENCRYPTION_MASTER_KEY=clave_maestra_vps_auramaster_super_secreta_2026

# Secreto JWT para Sesiones
SESSION_SECRET=secreto_de_sesion_vps_jwt_2026_seguro
```

### 4. Iniciar el Servidor de Desarrollo
```bash
npm run dev
```
Abre tu navegador en: **`http://localhost:3000`**

---

## 🚀 Despliegue en Producción (VPS)

### Opción A — Ejecución con PM2 y Node.js Autónomo

1. **Compilar el Frontend:**
   ```bash
   npm run build
   ```

2. **Iniciar con PM2:**
   ```bash
   npm install -g pm2
   pm2 start server/server.js --name "auramaster"
   pm2 save
   pm2 startup
   ```

### Opción B — Configuración con Nginx Reverse Proxy y SSL

Ejemplo de bloque de configuración de Nginx (`/etc/nginx/sites-available/auramaster`):

```nginx
server {
    server_name auramaster.tudominio.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🔒 Endpoints de Administración (API)

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `POST` | `/api/auth/google` | Verificación de ID Token e inicio de sesión OAuth |
| `GET` | `/api/auth/me` | Obtiene el perfil del usuario autenticado |
| `POST` | `/api/auth/logout` | Cierre seguro de sesión |
| `GET` | `/api/ai/config` | Obtiene el estado del baúl IA (clave enmascarada) |
| `POST` | `/api/ai/config` | Guarda y cifra la API Key con AES-256-GCM |
| `DELETE` | `/api/ai/config` | Elimina la API Key del baúl del VPS |
| `POST` | `/api/ai/mastering-suggestion` | Ejecuta la sugerencia IA en el proxy seguro |
| `GET` | `/api/admin/users` | Listado JSON de usuarios registrados y accesos |
| `GET` | `/api/admin/emails.csv` | Descarga el archivo CSV con los correos de usuarios |

---

## 📜 Licencia y Derechos

Desarrollado para ingeniería de sonido profesional y creación musical asistida por IA.
Todos los derechos reservados © 2026 **AuraMaster AI** • [oneforall-dev](https://github.com/oneforall-dev).
