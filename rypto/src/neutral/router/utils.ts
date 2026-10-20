const NAME = '[A-Za-z_$][\\w$]*';
export const OPTIONAL_WILDCARD: RegExp = new RegExp(
  `^\\[\\[\\.\\.\\.(${NAME})\\]\\]$`
);
export const WILDCARD: RegExp = new RegExp(`^\\[\\.\\.\\.(${NAME})\\]$`);
export const OPTIONAL: RegExp = new RegExp(`^\\[\\[(${NAME})\\]\\]$`);
export const PARAM: RegExp = new RegExp(`\\[(${NAME})\\]`, 'g');

export const SYNTAX_TOKEN: RegExp = new RegExp(
  `\\[\\[\\.\\.\\.${NAME}\\]\\]|\\[\\.\\.\\.${NAME}\\]|\\[\\[${NAME}\\]\\]|\\[${NAME}\\]`,
  'g'
);
