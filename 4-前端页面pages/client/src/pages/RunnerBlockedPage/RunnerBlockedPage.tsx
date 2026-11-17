import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserX } from 'lucide-react';
import BuyerLayout from '@client/src/components/BuyerLayout';
import { Button } from '@client/src/components/ui/button';

const RunnerBlockedPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <BuyerLayout title="顺手捎 · 校园代取" showTabBar={false}>
      <div className="flex flex-col items-center justify-center px-6 py-16">
        <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
          <UserX className="w-12 h-12 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">你还不是接单员</h2>
        <p className="text-sm text-muted-foreground text-center mb-8">
          申请成为接单员，审核通过后即可接单赚钱
        </p>
        <div className="w-full space-y-3">
          <Button
            className="w-full h-11"
            onClick={() => navigate('/apply-runner')}
          >
            申请成为接单员
          </Button>
          <Button
            variant="outline"
            className="w-full h-11"
            onClick={() => navigate('/buyer/home')}
          >
            返回首页
          </Button>
        </div>
      </div>
    </BuyerLayout>
  );
};

export default RunnerBlockedPage;
