alter table public.user_preferences
drop constraint if exists user_preferences_theme_name_check;

alter table public.user_preferences
add constraint user_preferences_theme_name_check
check (
  theme_name in (
    'midnight',
    'beige',
    'lime',
    'pink',
    'sky',
    'forest',
    'amber',
    'light',
    'light-teal',
    'light-rose',
    'light-amber',
    'light-sage'
  )
);
