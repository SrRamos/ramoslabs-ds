import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';

const theme = create({
  base: 'light',
  brandTitle: 'RamosLabs Design System',
  colorPrimary: '#4f46e5',
  colorSecondary: '#6366f1',
  appBg: '#f8fafc',
  appContentBg: '#ffffff',
  appBorderColor: '#e2e8f0',
  appBorderRadius: 8,
  textColor: '#0f172a',
  textMutedColor: '#64748b',
  barTextColor: '#64748b',
  barSelectedColor: '#4f46e5',
  barBg: '#ffffff',
  inputBg: '#ffffff',
  inputBorder: '#e2e8f0',
  inputTextColor: '#0f172a',
  inputBorderRadius: 8,
});

addons.setConfig({
  theme,
});
