import { AudioLines, Aperture, BookOpen, Code2, Diamond, LayoutTemplate, NotebookPen, Palette, Shapes, Type } from 'lucide-react';

const ICONS = {
  'ui-kits': LayoutTemplate,
  'code-templates': Code2,
  icons: Shapes,
  illustrations: Palette,
  fonts: Type,
  ebooks: BookOpen,
  'notion-templates': NotebookPen,
  presets: Aperture,
  audio: AudioLines,
};

export function CategoryIcon({ slug, ...props }) {
  const Icon = ICONS[slug] ?? Diamond;
  return <Icon strokeWidth={1.75} {...props} />;
}
