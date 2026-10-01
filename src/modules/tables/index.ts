import { RMSModule } from '@shared/types/module';
import { TablesPage } from './TablesPage';

export const TablesModule: RMSModule = {
  id: 'tables',
  name: 'Dine-In Tables & Running Tabs',
  description: 'Manage cafe dine-in tables, customer running tabs, table transfers, and checkout.',
  version: '1.0.0',
  icon: 'UtensilsCrossed',
  routes: [
    {
      path: '/tables',
      component: TablesPage,
      requiredPermission: 'pos.checkout',
      exact: true,
    },
  ],
  sidebarItems: [
    {
      id: 'dine-in-tables',
      labelKey: 'dine_in_tables',
      icon: 'UtensilsCrossed',
      path: '/tables',
      order: 7,
      requiredPermission: 'pos.checkout',
    },
  ],
  permissions: ['tables.manage'],
  translations: {
    en: {
      dine_in_tables: 'Dine-In Tables',
    },
    ar: {
      dine_in_tables: 'طاولات الصالة',
    },
  },
};

export { TablesPage };
