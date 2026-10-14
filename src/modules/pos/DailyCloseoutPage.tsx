import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DailyCloseoutModal } from './DailyCloseoutModal';

export const DailyCloseoutPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <DailyCloseoutModal
      isOpen={true}
      onClose={() => navigate('/pos')}
    />
  );
};
export default DailyCloseoutPage;
