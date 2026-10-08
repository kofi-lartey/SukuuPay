import React from 'react';
import { IdCardFront, IdCardBack } from '../students/idcards/IdCardPreview';

/**
 * A single CR80 card slot within an A4 sheet.
 * Renders the front or back based on the `side` prop.
 */
const IdCardSheetItem = ({
  card,
  side = 'front',
  school,
  showCutGuide = false,
  widthPt = 242.65,
  heightPt = 153.01,
}) => {
  const showPhoto = card.showPhoto !== undefined ? card.showPhoto : true;
  const showQr = card.showQr !== undefined ? card.showQr : true;
  const showStamp = card.showStamp !== undefined ? card.showStamp : true;

  const values = {
    studentId: card.studentId,
    studentName: card.studentName,
    studentClass: card.studentClass,
    guardianName: card.guardianName,
    guardianPhone: card.guardianPhone,
    emergencyContact: card.emergencyContact,
    studentImage: card.studentImage,
    qrCodeUrl: card.qrCodeUrl,
    academicYear: card.academicYear,
  };

  return (
    <div
      className={`relative ${showCutGuide ? 'cut-guide border border-slate-300' : ''}`}
      style={{ width: `${widthPt}pt`, height: `${heightPt}pt` }}
    >
      {side === 'front' ? (
        <IdCardFront
          values={values}
          school={school}
          showPhoto={showPhoto}
          showQr={showQr}
          showStamp={showStamp}
        />
      ) : (
        <IdCardBack values={values} school={school} />
      )}
    </div>
  );
};

export default IdCardSheetItem;
