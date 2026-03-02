# Translator — English to Hindi & Marathi Dictionary

A beautiful, open-source, single-page web application that translates English words into Hindi and Marathi. It not only provides translations but also offers comprehensive dictionary features like phonetics, definitions, example sentences, synonyms, and antonyms.

## ✨ Features

- **Multi-language Translation**: Instantly translate English words into Hindi and Marathi.
- **Comprehensive Meanings**: Get parts of speech, definitions, and example sentences.
- **Audio Pronunciations**: Listen to words and translated sentences in English, Hindi, and Marathi. (Includes robust support for iOS Safari via Web Speech API fallback mechanisms).
- **Smart Suggestions**: Auto-complete suggestions as you type.
- **Search History**: Keeps track of your recently searched words for quick access.
- **Dark Mode**: A beautifully crafted dark theme for late-night language learning.
- **Responsive Design**: Fully responsive layout that looks great on desktop, tablet, and mobile devices.

## 🚀 Tech Stack

This project is built using pure, vanilla web technologies. No build steps or complex frameworks are required.

- **HTML5**: Semantic structure.
- **CSS3**: Custom vanilla CSS with CSS variables for theming, CSS Grid, and Flexbox.
- **JavaScript**: ES6+ vanilla JavaScript for all logic, API calls, and state management.

### APIs Used

- **[Free Dictionary API](https://dictionaryapi.dev/)**: Used to fetch English word definitions, phonetics, synonyms, and antonyms.
- **Datamuse API**: Used to fetch word suggestions for the search autocomplete feature.
- **Google Translate API (Free endpoint)**: Used to translate words and example sentences into Hindi and Marathi, and for Text-to-Speech (TTS) capabilities.

## 🛠️ Usage

Since this is a vanilla HTML/CSS/JS project, you don't need Node.js or any build tools to run it.

1. **Clone the repository** (or download the ZIP file):
   ```bash
   git clone https://github.com/shlokkakde/ShabdKosh.git
   ```
2. **Open the project**:
   Simply open the `index.html` file in your favorite modern web browser (Chrome, Firefox, Safari, Edge).

## 📱 iOS Safari Audio Support

A notable technical feature of this project is the robust Text-to-Speech implementation. iOS Safari strictly blocks programmatic audio playback (like Google Translate TTS) without direct user interaction. This app implements a smart fallback strategy:
1. Attempts to use the native Web Speech API (`SpeechSynthesisUtterance`).
2. Tries to match the exact language voice.
3. Falls back to a Devanagari-compatible voice (like `hi-IN` for Marathi) if an exact voice is missing on the device.
4. Uses Google TTS as a final fallback for desktop and Android browsers.

## 🤝 Contributing

Contributions are welcome! If you'd like to improve the UI, add more languages, or optimize the API calls:

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## 📄 License

This project is Free & Open Source. 
