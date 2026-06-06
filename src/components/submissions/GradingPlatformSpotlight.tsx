export const GRADING_PRODUCT_NAME = 'Gradium';

export default function GradingPlatformSpotlight() {
  return (
    <div className="detail-card gradium-intro">
      <h3 className="gradium-intro-name">{GRADING_PRODUCT_NAME}</h3>
      <p className="gradium-intro-tagline">
        Intelligent assessment for programming coursework.
      </p>
      <p className="gradium-intro-signin">
        Sign in to submit notebooks or view your grades.
      </p>
    </div>
  );
}
