# Learn Language Plugin for Obsidian

An advanced language learning management plugin for Obsidian, featuring dictionary management, verb conjugation reference, interactive filtering, and OpenAI integration for AI-assisted term creation.

## Features

### 📚 Dictionary Management
- View and filter all dictionary entries from your vault
- Advanced filtering by French term, Spanish translation, type, context, and revision status
- Pagination support for large dictionaries
- Quick access via ribbon icon or command palette

### 🔤 Verb Conjugation Reference
- Dedicated view for verb entries
- Filter by verb group (1, 2, 3, irregular)
- Display conjugations: Présent, Subjonctif, Imparfait, Passé composé, Futur
- Track irregular verbs

### 📖 Study Mode (Flashcards)
- Toggle between normal view and study mode
- French → Spanish or Spanish → French directions
- Collapsible answers for self-testing
- Works in both Dictionary and Verbs views

### 🤖 OpenAI Integration
- AI-assisted term creation and classification
- Automatic translation suggestions
- Term type and context classification based on your custom taxonomies
- Auto-sync of type/context files with OpenAI Assistant

### 🔍 Advanced Filtering
- Filter by any property (French, Spanish, Type, Context, Revision)
- Hierarchical tag expansion (e.g., `#verbe/régulier/1` matches `#verbe`)
- Locale-aware sorting (French language)
- Filter state persistence

## Installation

### From Obsidian Community Plugins (Coming Soon)
1. Open Settings → Community plugins
2. Search for "Learn Language"
3. Install and enable

### Manual Installation
1. Download the latest release from GitHub
2. Extract to your vault's `.obsidian/plugins/learn-language/` folder
3. Reload Obsidian
4. Enable the plugin in Settings → Community plugins

### Build from Source
```bash
cd learn-language-plugin
npm install
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/learn-language/` folder.

## Configuration

Go to Settings → Learn Language to configure:

### Folder Paths
- **Dictionary folder**: Where your dictionary entries are stored (default: `10. Dictionary`)
- **Verbs folder**: Optional separate folder for verbs
- **Grammar folder**: Grammar resources location
- **Templates folder**: Note templates location

### Classification Files
- **Term types file**: File containing term type definitions (e.g., `#verbe`, `#nom`, `#expression`)
- **Context types file**: File containing context definitions (e.g., `#social`, `#culinary`)

### OpenAI Settings
- **API Key**: Your OpenAI API key
- **Auto-sync**: Automatically update types/context files in OpenAI when they change

## Usage

### Commands
Access via Command Palette (Ctrl/Cmd + P):

| Command | Description |
|---------|-------------|
| Open Dictionary View | Open the dictionary browser |
| Open Verbs View | Open the verbs browser |
| Create New Term | Open modal to create a new dictionary entry |
| Ask AI for Term | Quick AI lookup and term creation |
| Edit Current Term | Edit the currently open dictionary entry |
| Refresh Dictionary Cache | Force reload of dictionary data |
| Reset OpenAI Conversation | Start fresh AI conversation thread |

### Ribbon Icons
- 📖 **Book icon**: Open Dictionary View
- 🗣️ **Languages icon**: Open Verbs View
- ➕ **Plus icon**: Create New Term

### Dictionary Entry Structure

Your dictionary entries should follow this structure:

```markdown
---
Spanish: translation
cssclasses:
  - ja-readable
---

Type:: #verbe/régulier/1
Synonyms::
Context:: #social/greetings
Examples:: Bonjour, comment allez-vous?<br>Bonjour à tous!
Rating:: #⭐⭐
Relations::
Revision:: 1
Project:: [[Learn French]]
```

### Global API (Dataview Compatibility)

The plugin exposes a global API for use in Dataview scripts:

```javascript
// Get all dictionary entries
const entries = await window.learnLanguage.getDictionary();

// Get all verbs
const verbs = await window.learnLanguage.getVerbs();

// Get grammar pages
const grammar = await window.learnLanguage.getGrammarPages();

// Filter entries
const filtered = window.learnLanguage.filterEntries(entries, {
  Type: "#verbe",
  Context: "#social"
});

// Paginate results
const page = window.learnLanguage.paginateEntries(filtered, 0, 100);

// Ask AI for a term
const response = await window.learnLanguage.askAI("bonjour");

// Create a new term
await window.learnLanguage.createTerm({
  French: "bonjour",
  Spanish: "hola",
  Type: "#expression",
  Context: "#social/greetings"
});
```

## Migration from Dataview Scripts

If you're migrating from the previous Dataview-based implementation:

1. **Install the plugin** and configure folder paths in settings
2. **Keep your existing queries** - they'll continue to work via the global API
3. **Gradually migrate** to plugin views for better performance
4. **Move OpenAI settings** from JSON file to plugin settings

### Legacy Support

The plugin includes CSS classes from the original implementation:
- `ja-readable`, `ja-dictionary`, `ja-mobile`
- `ja-sticky-header`, `ja-table-verbs`
- `ja-filter-active`, `ja-collapsible`

## Development

```bash
# Install dependencies
npm install

# Build for development (watch mode)
npm run dev

# Build for production
npm run build
```

### Project Structure

```
learn-language-plugin/
├── src/
│   ├── main.ts              # Plugin entry point
│   ├── types.ts             # TypeScript types and interfaces
│   ├── settings.ts          # Settings tab
│   ├── services/
│   │   ├── DictionaryService.ts  # Data management
│   │   ├── OpenAIService.ts      # AI integration
│   │   ├── TermService.ts        # Term CRUD operations
│   │   └── FilterService.ts      # Filtering logic
│   ├── views/
│   │   ├── DictionaryView.ts     # Dictionary browser
│   │   └── VerbsView.ts          # Verbs browser
│   └── modals/
│       └── TermModal.ts          # Term create/edit modal
├── styles.css               # Plugin styles
├── manifest.json            # Plugin manifest
└── package.json             # NPM configuration
```

## License

MIT License - see LICENSE file for details.

## Author

**Juanjo Arranz**

## Acknowledgments

- Built for use with the Obsidian Dataview plugin
- OpenAI GPT-4 for AI-assisted features
- Inspired by language learning methodologies
