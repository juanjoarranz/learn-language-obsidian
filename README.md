# Learn Language Plugin for Obsidian

A flexible language learning management plugin for Obsidian that supports **any language pair**. Features dictionary management, verb conjugation reference, interactive filtering, and OpenAI integration for AI-assisted term creation.

## Features

### 🌍 Multi-Language Support
- **Configurable language pair**: Learn any language from any source language
- Supports 25+ languages with automatic locale-based sorting
- Dynamic UI labels based on your configured languages

### 📚 Dictionary Management
- View and filter all dictionary entries from your vault
- Advanced filtering by target word, source translation, type, context, and revision status
- Pagination support for large dictionaries
- Quick access via ribbon icon or command palette

### 🔤 Verb Conjugation Reference
- Dedicated view for verb entries
- Filter by verb group (1, 2, 3, irregular)
- Display conjugations: Présent, Subjonctif, Imparfait, Passé composé, Futur
- Track irregular verbs

### 📖 Study Mode (Flashcards)
- Toggle between normal view and study mode
- Target → Source or Source → Target directions
- Collapsible answers for self-testing
- Works in both Dictionary and Verbs views

### 🤖 OpenAI Integration
- AI-assisted term creation and classification
- Automatic translation suggestions
- Term type and context classification based on your custom taxonomies
- Auto-sync of type/context files with OpenAI Assistant

### 🔍 Advanced Filtering
- Filter by any property (target word, source word, Type, Context, Revision)
- **Type-ahead search** for target and source word filters (real-time filtering as you type)
- Hierarchical tag expansion (e.g., `#verbe/régulier/1` matches `#verbe`)
- Locale-aware sorting based on target language
- Filter state persistence

### 📝 Embed Dictionary in Notes
- Use the `learn-dictionary` code block to embed an interactive dictionary directly in any note
- Full filtering and pagination support within the embedded view
- Same UI and functionality as the sidebar view
- Configure initial filters via YAML-like options

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

### Language Configuration

- **Target language**: The language you are learning (e.g., French, German, Italian)
- **Source language**: Your native/source language (e.g., Spanish, English)

The plugin automatically determines the correct locale for sorting based on the language name. Supported languages include: French, Spanish, Italian, Portuguese, German, English, Dutch, Swedish, Russian, Polish, Japanese, Chinese, Korean, Greek, Turkish, Arabic, and many more.

> **Note**: The language names are also used to find the corresponding frontmatter fields in your notes. For example, if `Target language` is "French" and `Source language` is "Spanish", the plugin will look for `French:` and `Spanish:` fields in your note frontmatter.

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

### Embedding Dictionary in Notes

You can embed an interactive dictionary view directly in any note using the `learn-dictionary` code block:

````markdown
```learn-dictionary
type: verb
context: A1
pageSize: 25
```
````

#### Available Options

| Option | Description | Default |
|--------|-------------|---------|
| `targetWord` | Initial filter for target word (type-ahead search) | `all` |
| `sourceWord` | Initial filter for source word (type-ahead search) | `all` |
| `type` | Filter by type (verb, noun, expression, etc.) | `all` |
| `context` | Filter by context (A1, A2, social, etc.) | `all` |
| `revision` | Filter by revision status | `all` |
| `study` | Study mode (`no`, `yes`, `spanish`) | `no` |
| `limit` | Maximum number of entries to load | no limit |
| `pageSize` | Entries per page | `50` |
| `showStudy` | Show study mode toggle | `true` |
| `showPagination` | Show pagination controls | `true` |

#### Examples

**Show only verbs with context A1:**
````markdown
```learn-dictionary
type: verb
context: A1
pageSize: 20
```
````

**Simple embedded dictionary with 100 entries max:**
````markdown
```learn-dictionary
limit: 100
showStudy: false
```
````

**Full dictionary with all options:**
````markdown
```learn-dictionary
type: expression
context: social
pageSize: 50
showStudy: true
showPagination: true
```
````

> **Note**: The embedded dictionary uses the same `DictionaryComponent` as the sidebar view, so all interactive features (type-ahead search, filters, pagination, study mode) work identically.

### Global API (Dataview Compatibility)

The plugin exposes a global API for use in Dataview scripts:

```javascript
// Access the plugin API
const learnLanguage = app.plugins.plugins["learn-language"];
const api = learnLanguage.api;

// Get language configuration
const targetLang = api.targetLanguage;  // e.g., "French"
const sourceLang = api.sourceLanguage;  // e.g., "Spanish"

// Get all dictionary entries
const entries = await api.getDictionary();

// Get all verbs
const verbs = await api.getVerbs();

// Get grammar pages
const grammar = await api.getGrammarPages();

// Filter entries
const filtered = api.filterEntries(entries, {
  type: "#verbe",
  context: "#social"
});

// Paginate results
const page = api.paginateEntries(filtered, 0, 100);

// Ask AI for a term
const response = await api.askAI("bonjour");

// Create a new term
await api.createTerm({
  targetWord: "bonjour",
  sourceWord: "hola",
  type: "#expression",
  context: "#social/greetings"
});
```

#### Entry Structure

Dictionary entries returned by the API have these properties:

| Property | Description |
|----------|-------------|
| `file` | Object with `path`, `name`, `basename` |
| `targetWord` | The word in target language (lowercase) |
| `sourceWord` | Translation in source language (lowercase) |
| `type` | Term type tags (e.g., `#verbe`, `#nom`) |
| `context` | Context tags (e.g., `#social`, `#culinary`) |
| `revision` | Revision status (`new`, `1`, `2`, etc.) |
| `rating` | Optional rating |
| `examples` | Usage examples |
| `synonyms` | Related synonyms |
| `relations` | Related terms |
| `project` | Associated project |

#### Example: Dynamic Table Headers

```javascript
const api = app.plugins.plugins["learn-language"].api;
const entries = await api.getDictionary();

// Use configured language names as headers
dv.table(
    [api.targetLanguage, api.sourceLanguage, "Type", "Examples"],
    entries.slice(0, 20).map(e => [
        dv.fileLink(e.file.path, false, e.file.name),
        e.sourceWord || "",
        e.type || "",
        e.examples || ""
    ])
);
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
│   │   ├── DictionaryView.ts     # Dictionary browser (sidebar)
│   │   └── VerbsView.ts          # Verbs browser (sidebar)
│   ├── components/
│   │   └── DictionaryComponent.ts # Reusable dictionary UI component
│   ├── processors/
│   │   └── DictionaryCodeBlockProcessor.ts # Embed dictionary in notes
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
