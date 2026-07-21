import { $ } from './dom.js'

class GoogleTranslator {
    // CONFIGURACIÓN IDIOMAS
    static SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh']

    static FULL_LANGUAGES_CODES = {
        es: 'es-ES',
        en: 'en-US',
        fr: 'fr-FR',
        de: 'de-DE',
        it: 'it-IT',
        pt: 'pt-PT',
        ja: 'ja-JP',
        zh: 'zh-CN'
    }

    static DEFAULT_SOURCE_LANGUAGE = 'es'
    static DEFAULT_TARGET_LANGUAGE = 'en'

    static ERROR_MESSAGES = {
        NETWORK: 'Error de conexión. Verifica tu internet.',
        API_UNAVAILABLE: 'API de traducción no disponible en este navegador.',
        MODEL_UNAVAILABLE: 'Modelo de traducción no disponible para este par de idiomas.',
        FALLBACK_FAILED: 'El servicio de respaldo también falló.',
        GENERIC: 'Error al traducir. Intenta de nuevo.',
    }

    constructor() {
        this.init()
        this.setupEventListeners()

        this.translationTimeout = null
        this.translatorPool = new Map()
        this.currentDetector = null
        this.translationCache = null
    }

    init() {
        this.inputText = $('#inputText')
        this.outputText = $('#outputText')
        this.detectedLangBadge = $('#detectedLangBadge')
        this.sourceLanguage = $('#sourceLanguage')
        this.targetLanguage = $('#targetLanguage')
        this.micButton = $('#micButton')
        this.copyButton = $('#copyButton')
        this.speakerButton = $('#speakerButton')
        this.swapLanguagesButton = $('#swapLanguages')
        this.clearButton = $('#clearButton')
        this.themeToggle = $('#themeToggle')
        this.charCounter = $('#charCounter')
        this.historyToggle = $('#historyToggle')
        this.historyPanel = $('#historyPanel')

        this.targetLanguage.value = GoogleTranslator.DEFAULT_TARGET_LANGUAGE

        this.initTheme()
        this.initCache()
        this.renderHistory()
        this.checkAPISupport()
    }

    checkAPISupport() {
        this.hasNativeTranslator = 'Translator' in window
        this.hasNativeDetector = 'LanguageDetector' in window

        if (!this.hasNativeTranslator || !this.hasNativeDetector) {
            console.warn('APIs nativas de traducción o detección NO soportadas.')
            this.showAPIWarning()
            return false
        }

        console.log('APIs nativas de IA disponibles')
        return true
    }

    showAPIWarning() {
        const warning = $('#apiWarning')
        warning.style.display = 'block'
    }

    initTheme() {
        const saved = localStorage.getItem('theme')
        if (saved === 'dark') {
            document.body.classList.add('dark')
            this.themeToggle.innerHTML = '<span class="material-symbols-outlined">light_mode</span>'
        }
    }

    toggleTheme() {
        const isDark = document.body.classList.toggle('dark')
        this.themeToggle.innerHTML = isDark
            ? '<span class="material-symbols-outlined">light_mode</span>'
            : '<span class="material-symbols-outlined">dark_mode</span>'
        localStorage.setItem('theme', isDark ? 'dark' : 'light')
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const isCtrl = e.ctrlKey || e.metaKey
            if (!isCtrl) return

            switch (e.key.toLowerCase()) {
                case 'enter':
                    e.preventDefault()
                    this.translate()
                    break
                case 'l':
                    e.preventDefault()
                    this.clearText()
                    break
                case 'm':
                    e.preventDefault()
                    this.startVoiceRecognition()
                    break
            }

            if (isCtrl && e.shiftKey && e.key.toLowerCase() === 'c') {
                e.preventDefault()
                this.copyTranslation()
            }
        })
    }

    copyTranslation() {
        const text = this.outputText.textContent
        if (!text || text === 'Traduciendo...') return
        navigator.clipboard.writeText(text)
        this.copyButton.style.backgroundColor = 'var(--google-green)'
        this.copyButton.style.color = 'white'
        setTimeout(() => {
            this.copyButton.style.backgroundColor = ''
            this.copyButton.style.color = ''
        }, 600)
    }

    updateCharCounter() {
        const len = this.inputText.value.length
        this.charCounter.textContent = `${len} / 5000`
    }

    setupEventListeners() {
        this.inputText.addEventListener('input', () => {
            this.updateCharCounter()
            this.debounceTranslate()
        })
        this.sourceLanguage.addEventListener('change', () => this.translate())
        this.targetLanguage.addEventListener('change', () => this.translate())

        this.swapLanguagesButton.addEventListener('click', () => this.swapLanguages())
        this.micButton.addEventListener('click', () => this.startVoiceRecognition())
        this.speakerButton.addEventListener('click', () => this.speakTranslation())
        this.copyButton.addEventListener('click', () => this.copyTranslation())
        this.themeToggle.addEventListener('click', () => this.toggleTheme())
        this.historyToggle.addEventListener('click', () => this.toggleHistory())

        this.clearButton.addEventListener('click', () => this.clearText())

        this.setupKeyboardShortcuts()
    }

    clearText() {
        this.inputText.value = ''
        this.outputText.textContent = ''
        this.sourceLanguage.value = GoogleTranslator.DEFAULT_SOURCE_LANGUAGE
        this.targetLanguage.value = GoogleTranslator.DEFAULT_TARGET_LANGUAGE

        const autoOption = this.sourceLanguage.querySelector(`option[value="auto"]`)
        if (autoOption) autoOption.textContent = 'Detectar idioma'
        this.detectedLangBadge.textContent = ''


    }

    debounceTranslate() {
        clearTimeout(this.translationTimeout)
        this.translationTimeout = setTimeout(() => this.translate(), 300)
    }

    updateDetectedLanguage(detectedLanguage) {
        const option = this.sourceLanguage.querySelector(`option[value="${detectedLanguage}"]`)
        const autoOption = this.sourceLanguage.querySelector(`option[value="auto"]`)
        if (option) {
            autoOption.textContent = `Detectar idioma (${option.textContent})`
        } else {
            autoOption.textContent = `Detectar idioma (${detectedLanguage} - no soportado)`
        }
        this.detectedLangBadge.textContent = option
            ? `Detectado: ${option.textContent}`
            : `Idioma no soportado: ${detectedLanguage}`
    }

    async translate() {
        const text = this.inputText.value.trim()
        if (!text) {
            this.outputText.textContent = ''
            this.detectedLangBadge.textContent = ''
            return
        }

        this.outputText.innerHTML = '<span class="loading">Traduciendo...</span>'

        if (this.sourceLanguage.value === 'auto') {
            const detectedLanguage = await this.detectLanguage(text)
            this.updateDetectedLanguage(detectedLanguage)
        }

        try {
            const translation = await this.getTranslation(text)
            this.outputText.textContent = translation
            this.addToHistory(text, translation)
        } catch (error) {
            console.error(error)
            this.outputText.textContent = error.message || GoogleTranslator.ERROR_MESSAGES.GENERIC
        }
    }

    getCacheKey(source, target, text) {
        return `${source}:${target}:${text}`
    }

    initCache() {
        try {
            const stored = localStorage.getItem('translationCache')
            this.translationCache = stored ? new Map(Object.entries(JSON.parse(stored))) : new Map()
        } catch {
            this.translationCache = new Map()
        }
    }

    saveCache() {
        try {
            const obj = Object.fromEntries(this.translationCache)
            if (obj.size > 500) {
                const keys = Object.keys(obj).slice(0, 300)
                const trimmed = {}
                for (const k of keys) trimmed[k] = obj[k]
                localStorage.setItem('translationCache', JSON.stringify(trimmed))
            } else {
                localStorage.setItem('translationCache', JSON.stringify(obj))
            }
        } catch {
        }
    }

    getFromCache(key) {
        return this.translationCache?.get(key) ?? null
    }

    setCache(key, value) {
        if (!this.translationCache) this.initCache()
        this.translationCache.set(key, value)
        this.saveCache()
    }

    async translateWithMyMemory(text, sourceLanguage, targetLanguage) {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLanguage}|${targetLanguage}`
        const response = await fetch(url)
        if (!response.ok) throw new Error('MyMemory API error')
        const data = await response.json()
        return data.responseData.translatedText
    }

    async getTranslation(text) {
        const sourceLanguage =
            this.sourceLanguage.value === 'auto'
                ? await this.detectLanguage(text)
                : this.sourceLanguage.value

        const targetLanguage = this.targetLanguage.value
        if (sourceLanguage === targetLanguage) return text

        const cacheKey = this.getCacheKey(sourceLanguage, targetLanguage, text)
        const cached = this.getFromCache(cacheKey)
        if (cached) return cached

        if (this.hasNativeTranslator && this.hasNativeDetector) {
            try {
                const status = await window.Translator.availability({ sourceLanguage, targetLanguage })
                if (status === 'unavailable') {
                    throw new Error(GoogleTranslator.ERROR_MESSAGES.MODEL_UNAVAILABLE)
                }
            } catch (error) {
                if (error.message === GoogleTranslator.ERROR_MESSAGES.MODEL_UNAVAILABLE) throw error
                throw new Error(GoogleTranslator.ERROR_MESSAGES.API_UNAVAILABLE)
            }

            const translatorKey = `${sourceLanguage}-${targetLanguage}`

            try {
                let translator = this.translatorPool.get(translatorKey)
                if (!translator) {
                    translator = await window.Translator.create({
                        sourceLanguage,
                        targetLanguage,
                        monitor: (monitor) => {
                            monitor.addEventListener('downloadprogress', (e) => {
                                this.outputText.innerHTML = `<span class="loading">
                                    Descargando modelo: ${Math.floor(e.loaded * 100)}%
                                </span>`
                            })
                        }
                    })
                    this.translatorPool.set(translatorKey, translator)
                }

                const result = await translator.translate(text)
                this.setCache(cacheKey, result)
                return result
            } catch {
                console.warn('API nativa falló, usando MyMemory fallback')
            }
        }

        try {
            const fallback = await this.translateWithMyMemory(text, sourceLanguage, targetLanguage)
            this.setCache(cacheKey, fallback)
            return fallback
        } catch {
            throw new Error(GoogleTranslator.ERROR_MESSAGES.FALLBACK_FAILED)
        }
    }

    // HISTORIAL
    addToHistory(input, output) {
        const source = this.sourceLanguage.value === 'auto'
            ? (this.detectedLangBadge.textContent.match(/\((.+)\)/)?.[1] ?? 'Detectar')
            : this.sourceLanguage.options[this.sourceLanguage.selectedIndex]?.text ?? this.sourceLanguage.value
        const target = this.targetLanguage.options[this.targetLanguage.selectedIndex]?.text ?? this.targetLanguage.value

        let history = []
        try {
            history = JSON.parse(localStorage.getItem('translationHistory') ?? '[]')
        } catch { history = [] }

        history.unshift({ input, output, source, target, timestamp: Date.now() })
        if (history.length > 20) history = history.slice(0, 20)

        localStorage.setItem('translationHistory', JSON.stringify(history))
        this.renderHistory()
    }

    renderHistory() {
        if (!this.historyPanel) return
        let history = []
        try {
            history = JSON.parse(localStorage.getItem('translationHistory') ?? '[]')
        } catch { history = [] }

        if (history.length === 0) {
            this.historyPanel.innerHTML = '<div class="history-empty">Sin traducciones recientes</div>'
            return
        }

        this.historyPanel.innerHTML = history.map((entry, i) => `
            <div class="history-item" data-index="${i}">
                <div class="history-lang">${entry.source} → ${entry.target}</div>
                <div class="history-input">${this.escapeHtml(entry.input)}</div>
                <div class="history-output">${this.escapeHtml(entry.output)}</div>
            </div>
        `).join('')

        this.historyPanel.querySelectorAll('.history-item').forEach((el) => {
            el.addEventListener('click', () => {
                const entry = history[el.dataset.index]
                if (entry) {
                    this.inputText.value = entry.input
                    this.updateCharCounter()
                    this.outputText.textContent = entry.output
                }
            })
        })
    }

    toggleHistory() {
        const isVisible = this.historyPanel.classList.toggle('visible')
        this.historyToggle.classList.toggle('active', isVisible)
    }

    escapeHtml(str) {
        const div = document.createElement('div')
        div.textContent = str
        return div.innerHTML
    }

    // INTERCAMBIO DE IDIOMAS
    async swapLanguages() {
        if (this.sourceLanguage.value === 'auto') {
            const detectedLanguage = await this.detectLanguage(this.inputText.value)
            this.sourceLanguage.value = detectedLanguage
        }

        const temp = this.sourceLanguage.value
        this.sourceLanguage.value = this.targetLanguage.value
        this.targetLanguage.value = temp

        this.inputText.value = this.outputText.textContent
        this.outputText.textContent = ''

        if (this.inputText.value.trim()) this.translate()
    }

    // VOZ / AUDIO
    getFullLanguageCode(lang) {
        return GoogleTranslator.FULL_LANGUAGES_CODES[lang] ?? GoogleTranslator.DEFAULT_SOURCE_LANGUAGE
    }

    async startVoiceRecognition() {
        const hasRecognition = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
        if (!hasRecognition) return

        const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition
        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = false

        const lang =
            this.sourceLanguage.value === 'auto'
                ? await this.detectLanguage(this.inputText.value)
                : this.sourceLanguage.value

        recognition.lang = this.getFullLanguageCode(lang)

        recognition.onstart = () => {
            this.micButton.style.backgroundColor = 'var(--google-red)'
            this.micButton.style.color = 'white'
        }

        recognition.onend = () => {
            this.micButton.style.backgroundColor = ''
            this.micButton.style.color = ''
        }

        recognition.onresult = (event) => {
            const [{ transcript }] = event.results[0]
            this.inputText.value = transcript
            this.translate()
        }

        recognition.onerror = (event) => console.error('Error de reconocimiento de voz:', event.error)
        recognition.start()
    }

    speakTranslation() {
        const hasSpeech = 'speechSynthesis' in window
        if (!hasSpeech) return

        const text = this.outputText.textContent
        if (!text) return

        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = this.getFullLanguageCode(this.targetLanguage.value)
        utterance.rate = 0.8

        utterance.onstart = () => {
            this.speakerButton.style.backgroundColor = 'var(--google-green)'
            this.speakerButton.style.color = 'white'
        }

        utterance.onend = () => {
            this.speakerButton.style.backgroundColor = ''
            this.speakerButton.style.color = ''
        }

        window.speechSynthesis.speak(utterance)
    }

    // DETECCIÓN DE IDIOMA
    async detectLanguage(text) {
        try {
            if (!this.currentDetector) {
                this.currentDetector = await window.LanguageDetector.create({
                    expectedInputLanguages: GoogleTranslator.SUPPORTED_LANGUAGES
                })
            }

            const results = await this.currentDetector.detect(text)
            const detected = results[0]?.detectedLanguage

            return detected === 'und'
                ? GoogleTranslator.DEFAULT_SOURCE_LANGUAGE
                : detected
        } catch (error) {
            console.error('No he podido averiguar el idioma:', error)
            return GoogleTranslator.DEFAULT_SOURCE_LANGUAGE
        }
    }
}

// INICIALIZAR
const googleTranslator = new GoogleTranslator()