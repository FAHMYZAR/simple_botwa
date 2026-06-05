class Formatter {
  /**
   * Format text as bold (*text*)
   * @param {string} text 
   */
  static bold(text) {
    return `*${text}*`;
  }

  /**
   * Format text as italic (_text_)
   * @param {string} text 
   */
  static italic(text) {
    return `_${text}_`;
  }

  /**
   * Format text as strikethrough (~text~)
   * @param {string} text 
   */
  static strike(text) {
    return `~${text}~`;
  }

  /**
   * Format text as monospace/code (`text`)
   * @param {string} text 
   */
  static code(text) {
    return `\`${text}\``;
  }

  /**
   * Format text as code block (```text```)
   * @param {string} text 
   */
  static codeBlock(text, lang = '') {
    return `\`\`\`${lang}\n${text}\n\`\`\``;
  }

  /**
   * Format text as quote (> text)
   * @param {string} text 
   */
  static quote(text) {
    return `> ${text}`;
  }

  /**
   * Create a bullet list
   * @param {string[]} items 
   */
  static list(items) {
    return items.map(item => `• ${item}`).join('\n');
  }

  /**
   * Create a numbered list
   * @param {string[]} items 
   */
  static numberedList(items) {
    return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
  }

  /**
   * Format section title
   * @param {string} title 
   */
  static section(title) {
    return `\n${this.quote(this.bold(title))}`;
  }
}

module.exports = Formatter;
