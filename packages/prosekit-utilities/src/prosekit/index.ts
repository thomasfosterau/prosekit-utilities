/**
 * `@thomasfosterau/prosekit-utilities/prosekit` — the ProseKit runtime half:
 * node and mark definitions, the extension presets, lazily compiled schemas,
 * the derived document schema and the HTML renderer.
 *
 * @module
 */

export {
  MENTION_ATTRIBUTE_OVERRIDES,
  mergeAttributeOverrides,
  STANDARD_ATTRIBUTE_OVERRIDES,
  type AttributeOverrides,
} from './attribute-overrides.ts';
export {
  defineDocumentSchema,
  DocumentDecodeError,
  installDocumentGrammars,
  type DocumentSchema,
  type DocumentSchemaOptions,
} from './document-schema.ts';
export {
  createHtmlRenderer,
  HtmlRenderError,
  sanitiseDocument,
  type HtmlRenderer,
  type HtmlRendererOptions,
} from './html.ts';
export { lazySchema } from './lazy-schema.ts';
export {
  defineBold,
  defineCitation,
  defineCode,
  defineHighlight,
  defineItalic,
  defineLink,
  defineStandardMarks,
  defineStrike,
  defineSubscript,
  defineSuperscript,
  defineUnderline,
  type BoldExtension,
  type CodeExtension,
  type ItalicExtension,
  type LinkExtension,
  type StrikeExtension,
  type UnderlineExtension,
} from './marks.ts';
export {
  defineBlockquote,
  defineCodeBlock,
  defineDoc,
  defineFigcaption,
  defineFigure,
  defineFigureNode,
  defineHardBreak,
  defineHeading,
  defineHorizontalRule,
  defineImage,
  defineInlineDoc,
  defineList,
  defineMention,
  defineParagraph,
  defineSidenote,
  defineTable,
  defineText,
  type BlockquoteExtension,
  type CodeBlockExtension,
  type DocExtension,
  type HardBreakExtension,
  type HeadingExtension,
  type HorizontalRuleExtension,
  type ImageExtension,
  type ListExtension,
  type ParagraphExtension,
  type TableExtension,
  type TextExtension,
} from './nodes.ts';
export {
  defineBlockDocumentExtension,
  defineEditorBehaviour,
  defineInlineDocumentExtension,
  type BlockDocumentExtension,
  type InlineDocumentExtension,
} from './presets.ts';
