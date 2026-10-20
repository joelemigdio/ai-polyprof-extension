import { PeerIcon, StarIcon } from "./Icons";

interface RatingPillsProps {
  starRating: number;
  peerRating: number;
}

export function RatingPills({ starRating, peerRating }: RatingPillsProps) {
  return (
    <div className="rating-pills">
      <span className="pill pill-star" aria-label={`Overall rating ${starRating.toFixed(1)} out of 5`}>
        <StarIcon size={15} />
        {starRating.toFixed(1)}
      </span>
      <span className="pill pill-peer" aria-label={`Similar-student rating ${peerRating.toFixed(1)} out of 5`}>
        <PeerIcon size={15} />
        {peerRating.toFixed(1)}
      </span>
    </div>
  );
}
