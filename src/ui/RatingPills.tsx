import { formatRating, ratingScaleMax } from "../models/professor";
import { PeerIcon, StarIcon } from "./Icons";

interface RatingPillsProps {
  starRating: number;
  clarityRating: number;
}

export function RatingPills({ starRating, clarityRating }: RatingPillsProps) {
  const overall = formatRating(starRating);
  const clarity = formatRating(clarityRating);

  return (
    <div className="rating-pills">
      <span
        className="pill pill-star"
        title={`PolyRatings overall rating, ${overall} out of ${ratingScaleMax}`}
        aria-label={`Overall rating ${overall} out of ${ratingScaleMax}`}
      >
        <StarIcon size={15} />
        {overall}
      </span>
      <span
        className="pill pill-peer"
        title={`Presents material clearly, ${clarity} out of ${ratingScaleMax}`}
        aria-label={`Presents material clearly ${clarity} out of ${ratingScaleMax}`}
      >
        <PeerIcon size={15} />
        {clarity}
      </span>
    </div>
  );
}
