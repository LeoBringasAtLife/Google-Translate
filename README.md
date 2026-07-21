# Traductor Inteligente

Una aplicación web progresiva (PWA) de traducción que utiliza las APIs de IA integradas en el navegador para traducir texto del lado del cliente, sin necesidad de servidores externos.

## Características

- **Traducción con IA local** — Utiliza `window.Translator` y `window.LanguageDetector` de Chrome para traducir directamente en el navegador con modelos de IA en el dispositivo.
- **API de respaldo** — Si la IA nativa no está disponible, usa la API pública de MyMemory Translated.
- **Detección automática de idioma** — Detecta el idioma de origen automáticamente.
- **7 idiomas compatibles:** Español, Inglés, Francés, Alemán, Italiano, Portugués y Chino.
- **Dictado por voz** — Entrada de texto mediante reconocimiento de voz (`Ctrl+M`).
- **Lectura en voz alta** — Reproduce la traducción con síntesis de voz.
- **Historial de traducciones** — Almacena las últimas 20 traducciones en el navegador.
- **Caché de traducciones** — Evita llamadas redundantes guardando resultados recientes.
- **Tema oscuro/claro** — Alterna con persistencia en `localStorage`.
- **Atajos de teclado** — `Ctrl+Enter` para traducir, `Ctrl+Shift+C` para copiar, `Ctrl+L` para limpiar, `Ctrl+M` para dictado.
- **PWA** — Instalable y funciona offline después de la primera carga.

## Tecnologías

- JavaScript vanilla (ES modules) — Sin frameworks ni bundlers
- HTML5 + CSS3 (responsive, modo oscuro, animaciones)
- Web APIs: Translator, LanguageDetector, SpeechRecognition, SpeechSynthesis
- Service Worker + Web App Manifest (PWA)
- ESLint + Prettier

## Requisitos

- Navegador basado en Chromium (Chrome, Edge, Opera, Brave) con soporte para APIs de IA. Puede requerir habilitar flags en `chrome://flags/#text-translation-api`.

## Instalación y uso

```bash
git clone https://github.com/LeoBringasAtLife/Google-Translate
```

```
cd Google-Translate
```

> No requiere dependencias para ejecutarse

# Servir con cualquier servidor HTTP estático:

```
python -m http.server 8080
```
```
npx serve .
```

Abrir `http://localhost:8080` en el navegador.

## Desarrollo

```bash
npm install
npm run lint    # ESLint
npm run format  # Prettier
```

## Licencia

MIT
