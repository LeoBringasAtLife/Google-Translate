import { $ } from './dom.js'

class GoogleTranslator {
    // CONFIGURACIÓN IDIOMAS
    static SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'zh']

    static FULL_LANGUAGES_CODES = {
        es: 'es-ES',
        en: 'en-US',
        fr: 'fr-FR',
        de: 'de-DE',
        it: 'it-IT',
        pt: 'pt-PT',
        ru: 'ru-RU',
        ja: 'ja-JP',
        zh: 'zh-CN'
    }

    static DEFAULT_SOURCE_LANGUAGE = 'es'
    static DEFAULT_TARGET_LANGUAGE = 'en'

    // INICIALIZACIÓN
    constructor() {
        this.init()
        this.setupEventListeners()

        this.translationTimeout = null
        this.currentTranslator = null
        this.currentTranslatorKey = null
        this.currentDetector = null
    }

    init() {
        // Elementos del DOM
        this.inputText = $('#inputText')
        this.outputText = $('#outputText')
        this.sourceLanguage = $('#sourceLanguage')
        this.targetLanguage = $('#targetLanguage')
        this.micButton = $('#micButton')
        this.copyButton = $('#copyButton')
        this.speakerButton = $('#speakerButton')
        this.swapLanguagesButton = $('#swapLanguages')
        this.clearButton = $('#clearButton')

        // Configuración inicial
        this.targetLanguage.value = GoogleTranslator.DEFAULT_TARGET_LANGUAGE

        // Verificar soporte API
        this.checkAPISupport()
    }

    // VERIFICACIÓN DE APIs
    checkAPISupport() {
        this.hasNativeTranslator = 'Translator' in window
        this.hasNativeDetector = 'LanguageDetector' in window

        if (!this.hasNativeTranslator || !this.hasNativeDetector) {
            console.warn('⚠️ APIs nativas de traducción o detección NO soportadas.')
            this.showAPIWarning()
            return false
        }

        console.log('✅ APIs nativas de IA disponibles')
        return true
    }

    showAPIWarning() {
        const warning = $('#apiWarning')
        warning.style.display = 'block'
    }

    // EVENTOS
    setupEventListeners() {
        this.inputText.addEventListener('input', () => this.debounceTranslate())
        this.sourceLanguage.addEventListener('change', () => this.translate())
        this.targetLanguage.addEventListener('change', () => this.translate())

        this.swapLanguagesButton.addEventListener('click', () => this.swapLanguages())
        this.micButton.addEventListener('click', () => this.startVoiceRecognition())
        this.speakerButton.addEventListener('click', () => this.speakTranslation())


        this.clearButton.addEventListener('click', () => this.clearText())
    }

    // ClearButton
    clearText() {
        this.inputText.value = ''
        this.outputText.textContent = ''
        this.sourceLanguage.value = GoogleTranslator.DEFAULT_SOURCE_LANGUAGE
        this.targetLanguage.value = GoogleTranslator.DEFAULT_TARGET_LANGUAGE

        // Restablecer texto de "Detectar idioma"
        const autoOption = this.sourceLanguage.querySelector(`option[value="auto"]`)
        if (autoOption) autoOption.textContent = 'Detectar idioma'

        console.log('Campos borrados.')


    }

    // FUNCIONES DE TRADUCCIÓN
    debounceTranslate() {
        clearTimeout(this.translationTimeout)
        this.translationTimeout = setTimeout(() => this.translate(), 500)
    }

    updateDetectedLanguage(detectedLanguage) {
        const option = this.sourceLanguage.querySelector(`option[value="${detectedLanguage}"]`)
        if (option) {
            const autoOption = this.sourceLanguage.querySelector(`option[value="auto"]`)
            autoOption.textContent = `Detectar idioma (${option.textContent})`
        }
    }

    async translate() {
        const text = this.inputText.value.trim()
        if (!text) {
            this.outputText.textContent = ''
            return
        }

        this.outputText.textContent = 'Traduciendo...'

        if (this.sourceLanguage.value === 'auto') {
            const detectedLanguage = await this.detectLanguage(text)
            this.updateDetectedLanguage(detectedLanguage)
        }

        try {
            const translation = await this.getTranslation(text)
            this.outputText.textContent = translation
        } catch (error) {
            console.error(error)
            const hasSupport = this.checkAPISupport()
            this.outputText.textContent = hasSupport
                ? 'Error al traducir'
                : '¡Error! No tienes soporte nativo a la API de traducción con IA'
        }
    }

    async getTranslation(text) {
        const sourceLanguage =
            this.sourceLanguage.value === 'auto'
                ? await this.detectLanguage(text)
                : this.sourceLanguage.value

        const targetLanguage = this.targetLanguage.value
        if (sourceLanguage === targetLanguage) return text

        // 1️. Verificar disponibilidad del modelo
        try {
            const status = await window.Translator.availability({ sourceLanguage, targetLanguage })
            if (status === 'unavailable') throw new Error(`Traducción de ${sourceLanguage} a ${targetLanguage} no disponible`)
        } catch (error) {
            console.error(error)
            throw new Error(`Traducción de ${sourceLanguage} a ${targetLanguage} no disponible`)
        }

        // 2️. Realizar la traducción
        const translatorKey = `${sourceLanguage}-${targetLanguage}`

        try {
            if (!this.currentTranslator || this.currentTranslatorKey !== translatorKey) {
                this.currentTranslator = await window.Translator.create({
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
            }

            this.currentTranslatorKey = translatorKey
            return await this.currentTranslator.translate(text)
        } catch (error) {
            console.error(error)
            return 'Error al traducir'
        }
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