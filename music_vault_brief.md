# MusicVault — Self-Hosted Private Music Manager

## Visión general

Quiero construir una aplicación **self-hosted** (para correr en mi propio servidor o mini PC) que replique las funcionalidades clave de **untitled.stream**, pero de forma completamente privada: sin servicios de terceros, sin cloud externo, con mis archivos en mi propio hardware.

La app es una herramienta personal para gestionar música en progreso (work-in-progress tracks), escucharla, organizarla y compartirla de forma controlada con 2-5 personas de confianza.

**Plataformas objetivo:**
- **iOS (iPhone/iPad)** — como PWA instalable desde Safari
- **Desktop Mac/Windows** — como app nativa via Tauri
- **Web** — acceso directo desde browser como fallback

---

## Stack

- **Backend**: Python + FastAPI
- **Frontend**: React + Tailwind CSS
- **Base de datos**: SQLite (con posibilidad de migrar a PostgreSQL)
- **Almacenamiento de audio**: sistema de archivos local (carpeta configurable)
- **Autenticación**: JWT
- **Entorno**: mini PC (x86, 8-16GB RAM) con Docker, Linux o macOS

### Capas de plataforma (sobre el mismo frontend React)

- **PWA (iOS)**: manifest.json + Service Worker. El usuario instala desde Safari → "Añadir a pantalla de inicio". Sin App Store, sin coste. Priorizar que el audio en background funcione correctamente en iOS 17+.
- **Tauri (Desktop)**: envuelve el frontend React en una ventana nativa para Mac y Windows. Sin barra de browser, con icono en dock/taskbar. El backend FastAPI corre embebido o como sidecar.

---

## Funcionalidades por prioridad

### Prioridad 1 — Core (MVP)

#### 1. Subida y reproducción de audio
- Subir archivos de audio (MP3, WAV, FLAC, AAC, OGG)
- Reproductor con controles básicos (play/pause, seek, volumen)
- Waveform visual del track (WaveSurfer.js)
- Los archivos se guardan en el servidor local
- Drag & drop para subir múltiples archivos a la vez con progreso visible

#### 2. Organización en proyectos y carpetas
- Crear **proyectos** (ej: "Album 2025", "Beats de verano")
- Dentro de cada proyecto, crear **carpetas** o categorías
- Mover tracks entre proyectos/carpetas
- Vista de árbol de navegación en sidebar

#### 3. Versioning de tracks
- Al subir una nueva versión de un track, el anterior queda guardado en historial
- Ver y reproducir versiones anteriores
- Cada versión tiene timestamp y nombre opcional

#### 4. Protección de links con contraseña
- Generar un link público para un track o proyecto
- El link puede tener contraseña opcional
- El link puede tener fecha de expiración opcional
- Página de reproducción pública minimalista (sin login requerido)

---

### Prioridad 2 — Audio tools

#### 5. Control de pitch y speed
- Slider para cambiar pitch (±12 semitones)
- Slider para cambiar velocidad (0.5x – 2.0x) independiente del pitch
- Implementar con Web Audio API o Tone.js
- Los cambios son solo en reproducción, no modifican el archivo

#### 6. Loop de secciones
- Marcar punto A y punto B sobre la waveform para hacer loop de una sección
- Interfaz visual clara sobre la waveform

#### 7. Grabación de ideas
- Botón de "Record" que usa el micrófono (MediaRecorder API)
- Guardar la grabación directamente como nuevo track en un proyecto
- Previsualización antes de guardar

---

### Prioridad 3 — Sharing & extras

#### 8. Notificaciones de escucha
- Cuando alguien abre un link compartido, registrar: timestamp, IP anonimizada
- Panel simple para ver cuándo y cuántas veces se escuchó cada track

#### 9. Modo offline (PWA)
- Service Worker para cachear los tracks más recientes
- Reproducir tracks cacheados sin conexión
- Especialmente importante para la experiencia iOS

---

## Estructura de datos básica

```
User
  └── Projects[]
        └── Folders[]
              └── Tracks[]
                    └── Versions[]

SharedLink
  - track_id o project_id
  - password_hash (opcional)
  - expires_at (opcional)
  - play_count
  - ListenEvents[]
```

---

## Seguridad y privacidad

- Todo corre localmente, sin servicios externos
- Autenticación con JWT
- Archivos de audio NO accesibles directamente por URL sin autenticación (streaming a través del backend)
- Los links públicos usan tokens opacos (no exponen IDs internos)
- HTTPS via reverse proxy (Nginx + Let's Encrypt o self-signed para LAN)

---

## Estructura de proyecto sugerida

```
musicvault/
├── backend/
│   ├── main.py
│   ├── models.py
│   ├── routes/
│   │   ├── auth.py
│   │   ├── tracks.py
│   │   ├── projects.py
│   │   └── share.py
│   ├── storage/
│   └── database.db
├── frontend/
│   ├── public/
│   │   ├── manifest.json        # PWA manifest
│   │   └── sw.js                # Service Worker para offline e iOS
│   ├── src/
│   │   ├── components/
│   │   │   ├── Player/          # Reproductor con waveform, pitch/speed, loop A-B
│   │   │   ├── Sidebar/         # Árbol de proyectos/carpetas
│   │   │   ├── TrackList/
│   │   │   └── ShareModal/
│   │   └── pages/
│   │       ├── Dashboard.jsx
│   │       ├── Project.jsx
│   │       └── PublicShare.jsx
├── tauri/                       # Configuración Tauri para desktop
│   ├── src-tauri/
│   │   ├── tauri.conf.json
│   │   └── main.rs
├── docker-compose.yml
└── README.md
```

---

## Orden de implementación

1. Setup: FastAPI + SQLite + React
2. Auth con JWT (login/logout)
3. Subida de archivos y streaming de audio
4. Reproductor con WaveSurfer.js + drag & drop
5. Proyectos y carpetas (CRUD)
6. Versioning de tracks
7. Links compartidos con contraseña y expiración
8. PWA: manifest.json + Service Worker (instalable en iOS desde Safari)
9. Controles de pitch/speed (Web Audio API)
10. Loop A-B sobre waveform
11. Grabación de micrófono
12. Analytics de escucha (listen events)
13. Tauri: empaquetar como app nativa Mac/Windows
14. Dockerizar backend + frontend

---

## Notas importantes

- **Hardware objetivo**: mini PC x86 con 8-16GB RAM, siempre encendido, con SSD. No Raspberry Pi (insuficiente para 2-5 usuarios concurrentes con 50-200GB de audio).
- **iOS**: PWA instalada desde Safari. Asegurarse de que el audio en background funcione en iOS 17+. Si falla de forma consistente, el siguiente paso sería Capacitor + TestFlight (requiere Apple Developer a 99€/año).
- **Desktop**: Tauri envuelve el frontend React. El backend FastAPI corre como proceso separado (sidecar) o en Docker en la misma máquina.
- **El pitch/speed corre en el browser del cliente**, no en el servidor — no añade carga al servidor.
- **Diseño UI**: dark mode, minimalista, inspirado en untitled.stream — limpio y orientado al audio.
- **Ancho de banda**: el cuello de botella para usuarios externos es la conexión a internet del servidor, no la CPU. Considerar servir archivos comprimidos (MP3/AAC) además del original para reducir consumo.
