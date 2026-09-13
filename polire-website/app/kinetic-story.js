import PolireMark from './mark';
export default function KineticStory({motion}) {
 return <div className="kinetic-story">
  <div className="kinetic-stage">
   <div className="kinetic-topline"><span>{motion.storyLabel}</span><span aria-hidden="true">POLIRE / 002</span></div>
   <div className="kinetic-composition">
    <div className="kinetic-word word-one">{motion.storyWords[0]}</div>
    <div className="kinetic-word word-two">{motion.storyWords[1]}</div>
    <div className="kinetic-word word-three">{motion.storyWords[2]}</div>
    <div className="kinetic-seal" aria-hidden="true"><PolireMark/></div>
   </div>
   <div className="kinetic-bottomline"><p>{motion.storyText}</p><span aria-hidden="true">↘</span></div>
   <div className="kinetic-rule" aria-hidden="true"/>
  </div>
 </div>;
}
