/** Opens the hosted BevyBroom user guide from editor help controls. */
export class DocumentationLink {
  /** Public web address for the documentation entry page. */
  static readonly URL = 'https://github.com/Henry00IS/AiWorldEd/blob/main/documentation/README.md';

  /** Opens the user guide in a separate browser tab without opener access. */
  open(): void {
    window.open(DocumentationLink.URL, '_blank', 'noopener,noreferrer');
  }
}
