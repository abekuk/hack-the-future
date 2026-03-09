export default function GeminiGradientText({ children, className = '', tag: Tag = 'span' }) {
  return (
    <Tag className={`gemini-gradient-text ${className}`}>
      {children}
    </Tag>
  );
}
