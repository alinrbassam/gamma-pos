import { RMSModule } from '@shared/types/module';
import { PlaystationPage } from './PlaystationPage';

export const PlaystationModule: RMSModule = {
  id: 'playstation',
  name: 'PlayStation Gaming Lounge',
  description: 'Manage gaming lounge consoles, multiplayer session timers, and snack orders.',
  version: '1.0.0',
  icon: 'Gamepad2',
  routes: [
    {
      path: '/playstation',
      component: PlaystationPage,
      requiredPermission: 'pos.checkout',
      exact: true,
    },
  ],
  sidebarItems: [
    {
      id: 'playstation-lounge',
      labelKey: 'playstation_lounge',
      icon: 'Gamepad2',
      path: '/playstation',
      order: 8,
      requiredPermission: 'pos.checkout',
    },
  ],
  permissions: ['playstation.manage'],
  translations: {
    en: {
      playstation_lounge: 'PlayStation Lounge',
    },
    ar: {
      playstation_lounge: 'صالة البلايستيشن',
    },
  },
};

export { PlaystationPage };
