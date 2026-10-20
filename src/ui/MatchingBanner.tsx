import { SparkleIcon } from "./Icons";

interface MatchingBannerProps {
  summary: string;
  onEdit: () => void;
}

export function MatchingBanner({ summary, onEdit }: MatchingBannerProps) {
  return (
    <div className="matching-banner">
      <SparkleIcon size={15} />
      <p>Matching on: {summary}</p>
      <button className="link-button" type="button" onClick={onEdit}>Edit</button>
    </div>
  );
}
