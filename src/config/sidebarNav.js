/**
 * Role-based sidebar navigation.
 * Each item: { path, label, icon (emoji or component name), roles }
 */

export const SIDEBAR_NAV = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: 'grid',
    roles: [
      'SUPER_ADMIN', 'CATEGORY_ADMIN',
      'WEBSITE_RESEARCHER', 'LINKEDIN_RESEARCHER',
      'WEBSITE_INQUIRER', 'LINKEDIN_INQUIRER',
      'WEBSITE_RESEARCH_AUDITOR', 'LINKEDIN_RESEARCH_AUDITOR',
      'WEBSITE_INQUIRY_AUDITOR', 'LINKEDIN_INQUIRY_AUDITOR',
    ],
  },
  {
    path: '/dashboard/categories',
    label: 'Categories',
    icon: 'folder',
    roles: ['SUPER_ADMIN', 'CATEGORY_ADMIN'],
  },
  {
    path: '/dashboard/users',
    label: 'All Users',
    icon: 'users',
    roles: ['SUPER_ADMIN', 'CATEGORY_ADMIN'],
  },
  {
    path: '/dashboard/research',
    label: 'Research',
    icon: 'search',
    roles: [
      'SUPER_ADMIN', 'CATEGORY_ADMIN',
      'WEBSITE_RESEARCHER', 'LINKEDIN_RESEARCHER',
      'WEBSITE_RESEARCH_AUDITOR', 'LINKEDIN_RESEARCH_AUDITOR',
    ],
  },
  {
    path: '/dashboard/inquiries',
    label: 'Inquiries',
    icon: 'mail',
    roles: [
      'SUPER_ADMIN', 'CATEGORY_ADMIN',
      'WEBSITE_INQUIRER', 'LINKEDIN_INQUIRER',
      'WEBSITE_INQUIRY_AUDITOR', 'LINKEDIN_INQUIRY_AUDITOR',
    ],
  },
  {
    path: '/dashboard/payments',
    label: 'Payments',
    icon: 'dollar',
    roles: ['SUPER_ADMIN', 'CATEGORY_ADMIN'],
  },
  {
    path: '/dashboard/notices',
    label: 'Notices',
    icon: 'bell',
    roles: [
      'SUPER_ADMIN', 'CATEGORY_ADMIN',
      'WEBSITE_RESEARCHER', 'LINKEDIN_RESEARCHER',
      'WEBSITE_INQUIRER', 'LINKEDIN_INQUIRER',
      'WEBSITE_RESEARCH_AUDITOR', 'LINKEDIN_RESEARCH_AUDITOR',
      'WEBSITE_INQUIRY_AUDITOR', 'LINKEDIN_INQUIRY_AUDITOR',
    ],
  },
];

export const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  CATEGORY_ADMIN: 'Category Admin',
  WEBSITE_RESEARCHER: 'Website Researcher',
  LINKEDIN_RESEARCHER: 'LinkedIn Researcher',
  WEBSITE_INQUIRER: 'Website Inquirer',
  LINKEDIN_INQUIRER: 'LinkedIn Inquirer',
  WEBSITE_RESEARCH_AUDITOR: 'Website Research Auditor',
  LINKEDIN_RESEARCH_AUDITOR: 'LinkedIn Research Auditor',
  WEBSITE_INQUIRY_AUDITOR: 'Website Inquiry Auditor',
  LINKEDIN_INQUIRY_AUDITOR: 'LinkedIn Inquiry Auditor',
};
