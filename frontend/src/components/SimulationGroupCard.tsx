import { Button } from '@/components/ui/button';
import UserAvatar from '@/components/UserAvatar';
import type { SimulationGroup } from '@/services/studentService';

interface SimulationGroupCardProps {
  group: SimulationGroup;
  onContinueTraining: (groupId: string) => void;
}

function SimulationGroupCard({ group, onContinueTraining }: SimulationGroupCardProps) {
  return (
    <div className="flex flex-col gap-4 p-6 border border-gray-300 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <UserAvatar
          name={group.name}
          imageUrl={group.iconUrl}
          size="medium"
          backgroundColor={group.iconColor}
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg leading-tight mb-1 text-gray-900">
            {group.name}
          </h3>
          <p className="text-sm text-gray-600">
            {group.subtitle}
          </p>
        </div>
      </div>
      <Button
        onClick={() => onContinueTraining(group.id)}
        variant="default"
        className="w-full bg-gray-800 text-white hover:bg-gray-900"
      >
        Continue Training
      </Button>
    </div>
  );
}

export default SimulationGroupCard;
