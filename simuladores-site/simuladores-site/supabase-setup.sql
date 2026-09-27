-- Los Simuladores — setup Supabase (proyecto nuevo)
-- URL: https://wxmnioanxrpgzzvkbpaa.supabase.co

create table if not exists public.episodes (
  id bigint primary key,
  season int not null,
  number int not null,
  title text not null default '',
  description text not null default '',
  duration int not null default 0,
  url text not null default '',
  thumb text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id bigserial primary key,
  episode_id bigint not null,
  name text not null default 'Anónimo',
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.episodes enable row level security;
alter table public.site_settings enable row level security;
alter table public.comments enable row level security;

drop policy if exists "episodes_public_read" on public.episodes;
create policy "episodes_public_read" on public.episodes for select using (true);

drop policy if exists "settings_public_read" on public.site_settings;
create policy "settings_public_read" on public.site_settings for select using (true);

drop policy if exists "comments_public_read" on public.comments;
create policy "comments_public_read" on public.comments for select using (true);

drop policy if exists "comments_public_insert" on public.comments;
create policy "comments_public_insert" on public.comments for insert with check (true);

drop policy if exists "episodes_admin_write" on public.episodes;
create policy "episodes_admin_write" on public.episodes
  for all
  using (auth.jwt() ->> 'email' = 'vennekof@gmail.com')
  with check (auth.jwt() ->> 'email' = 'vennekof@gmail.com');

drop policy if exists "settings_admin_write" on public.site_settings;
create policy "settings_admin_write" on public.site_settings
  for all
  using (auth.jwt() ->> 'email' = 'vennekof@gmail.com')
  with check (auth.jwt() ->> 'email' = 'vennekof@gmail.com');

drop policy if exists "comments_admin_delete" on public.comments;
create policy "comments_admin_delete" on public.comments
  for delete
  using (auth.jwt() ->> 'email' = 'vennekof@gmail.com');

insert into public.site_settings (id, data)
values (1, '{"siteName": "LOS SIMULADORES", "badgeText": "Serie argentina · HD", "heroTitle": "Los Simuladores", "heroSubtitle": "Las 2 temporadas completas en buena calidad", "heroBg": "fondo-simuladores.png", "tabTitle": "Los Simuladores | Capítulos HD", "ogDescription": "Las 2 temporadas completas en buena calidad.", "donateUrl": "https://ceneka.net/Vennek", "donateText": "Proyecto fan sin fines de lucro. Si te gusta el sitio, cualquier apoyo suma.", "s1Color": "#3eb34f", "s2Color": "#2a7a94", "ads": {"enabled": false, "homeTop": "", "homeBottom": "", "playerBelow": ""}, "cfBeacon": ""}'::jsonb)
on conflict (id) do update set data = excluded.data, updated_at = now();

insert into public.episodes (id, season, number, title, description, duration, url, thumb) values
(1, 1, 1, 'Tarjeta de Navidad', 'Una pareja está por divorciarse, pero el hombre contrata a expertos para que lo ayuden a reconquistar a su esposa.', 40, 'https://ok.ru/video/7286191491722', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgYm5voj9hF9n_iA6ft1ByjSIpa5tdrf9gXLcTQgL7aWYs&fn=external_8'),
(2, 1, 2, 'Diagnóstico rectoscópico', 'Laguzzi, un usurero despiadado, amenaza de muerte a los hijos de Vanegas, su cliente, si no paga la deuda antes de determinada fecha. Vanegas contrata a los Simuladores.', 44, 'https://ok.ru/video/9601507658378', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgYo-laKQqMCxf8RIU7KfUZShyRza1YXC6YBLlcPpG8kkc&fn=external_8'),
(3, 1, 3, 'Seguro de desempleo', 'Despiden a Feler tras cuarenta años de trabajo en una fábrica láctea. Los Simuladores se encargarán de conectar a Feler directamente con los dueños de la fábrica.', 49, 'https://ok.ru/video/7286192802442', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgYzKL6Uwea4VG4rq7gp0eOH8EzZ1mWZ2ik-NSIcN6fiBQ&fn=external_8'),
(4, 1, 4, 'El testigo español', 'Alicia, oftalmóloga, casada y madre de dos hijos, recibe sorpresivamente la visita en su propia casa de Villarreal, un egocéntrico colega español que quiere chantajearla.', 48, 'https://ok.ru/video/7286192605834', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgYI6QcvISfXhzivNiMBGImuJDQw3VlGkw6ZKKsgBfDApk&fn=external_8'),
(5, 1, 5, 'El joven simulador', 'A la mujer del arquitecto Miguens podrían quedarle pocos meses de vida. El médico recomienda que no le den malas noticias. Pero su hijo está a punto de repetir el año.', 47, 'https://ok.ru/video/7286192671370', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgYG7mNmn5ZEnNCCO06yhHCZZFFuGBqeMm-7oNScyLAWks&fn=external_8'),
(6, 1, 6, 'El pequeño problema del gran hombre', 'El Dr. Agustín Mendilaharzu, Presidente de la Nación, sufre de impotencia sexual. Por miedo a que la prensa se entere, se niega a ver a un sexólogo.', 54, 'https://ok.ru/video/9601509427850', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgY6gVU-hzpJTzJES5xxJMYrp_GrsL5tR9-OLOi3DU_iy4&fn=external_8'),
(7, 1, 7, 'Fuera de cálculo', 'Los Simuladores entran a un banco para extraer los negativos con fotos de Sorkin, su cliente, junto a su amante, de la caja de seguridad de un extorsionador.', 52, 'https://ok.ru/video/7286192736906', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgYHMYCHZmzpEbO6_xJPaWurJrUA_7sg1QREmQai0No1wM&fn=external_8'),
(8, 1, 8, 'El pacto copérnico', 'Zarazola es un abogado adúltero que desea desprenderse de Laura, su mujer, sin sentir culpa. Contacta a los Simuladores para que ella lo deje a él.', 57, 'https://ok.ru/video/9601510673034', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgYt7YJQubZOjI-Pd1WpsiZjHq3Y9jsS0R_9rFVEI8_ZhI&fn=external_8'),
(9, 1, 9, 'El último héroe', 'Milazzo, un falso representante de artistas, explota diversos barrios pobres, cobrando a sus clientes una matrícula para hacerlos famosos y llevarlos a trabajar.', 50, 'https://ok.ru/video/9601512311434', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgY89s5StIZKcT99w9_AUJffOewtEzPXvydgZwDUpJdiM4&fn=external_8'),
(10, 1, 10, 'Los impresentables', 'Clara, de padres muy ordinarios, está de novia con Federico, hijo de una familia elegante. Ante un encuentro familiar, Los Simuladores se encargan de que todo salga bien.', 51, 'https://ok.ru/video/9601513818762', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgY_iqB9ifwFUmy__Ttt-nkJUjUgvvh4-HePkbh8iiz7vI&fn=external_8'),
(11, 1, 11, 'El colaborador foráneo', 'Crucitti es un comisario corrupto que extorsiona a los dueños de los locales comerciales de su zona. Pero Los Simuladores se encargarán de resolver el problema.', 48, 'https://ok.ru/video/7286192474762', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgY3IjvN6HgJ8CDH-hum79twj2tupWu3xy5FvW2OCGBbvk&fn=external_8'),
(12, 1, 12, 'Marcela & Pau', 'Marcela está sumergida en una profunda depresión. No puede dormir bien y molesta permanentemente a su exmarido y a Natalia, su hija, quien convoca a Los Simuladores.', 51, 'https://ok.ru/video/7286193130122', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgYxhqXjf8g_4DyTAow9W8JpbCkgG4sMGTRZqQimPr9KWg&fn=external_8'),
(13, 1, 13, 'Un trabajo involuntario', 'Los Simuladores están pensando en tomarse unas vacaciones cuando secuestran a Santos, el estratega del grupo.', 58, 'https://ok.ru/video/9601515719306', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgYCupEdWiEeMZMuL0sfOI9nPOqwYqsUn8uca2QJbR_RH4&fn=external_8'),
(14, 2, 1, 'Los cuatro notables', 'Una mujer tiene que operar a su padre de urgencia, y en la clínica le dan la noticia de que su seguro médico no cubre el tratamiento de la operación.', 58, 'https://ok.ru/video/7289262312074', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgY9Rh4NnbKYzUMCf5rVAwh5eBexcqROCtzcVdSupp0PJE&fn=external_8'),
(15, 2, 2, 'Z-9000', 'Una mujer, que recibe golpes y maltratos por parte de su marido, contacta a Los Simuladores para que le resuelvan el problema.', 50, 'https://ok.ru/video/9602281245322', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgYhxfELvO6iBmYrqR3uAoXQ9YDqoYM2sWXJMY80Y-ucVo&fn=external_8'),
(16, 2, 3, 'La gargantilla de las cuatro estaciones', 'Un arquitecto teme serle infiel a su novia. Los Simuladores fingen rechazar el caso y lo involucran en una simulación para que deje de desear a otras mujeres.', 50, 'https://ok.ru/video/9602281310858', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgYke7rt6eYvKLSV0TCY1AlesVlZccHgGq9HaIfRoC7HZI&fn=external_8'),
(17, 2, 4, 'El clan Motul', 'Un grupo de ancianos está por perder el geriátrico donde viven. Los Simuladores montan una historia de vampiros para impedir la venta.', 55, 'https://ok.ru/video/7289262181002', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgY-ttDFjHFHO7sJkWYVwZyzElBrwa1FCbu8rptLH4i_Lo&fn=external_8'),
(18, 2, 5, 'El vengador infantil', 'Un chico de la escuela es el blanco de sus compañeros. Los Simuladores lo ayudan a ganar confianza y revertir la situación de abuso.', 58, 'https://ok.ru/video/9602281179786', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgYqUg9bG16dGcmGIUnKq8kYKsKGeFpA56t9FuA4yshTm8&fn=external_8'),
(19, 2, 6, 'El matrimonio mixto', 'Una pareja de distintas religiones (judía y católica) pide ayuda para que sus familias acepten el casamiento.', 66, 'https://ok.ru/video/7289262246538', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgYj-wHEhnWB4H5l6MJdSQTHMQ4x9lsQj1JKwsRKiC_6zo&fn=external_8'),
(20, 2, 7, 'La brigada B', 'Los colaboradores del equipo son tomados por terroristas. Los Simuladores deben infiltrarse para liberarlos.', 62, 'https://ok.ru/video/9602281114250', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgYydjukjSVNQb4BgDiXsdhCD955hJxwsQ8jUt0UCD4C_E&fn=external_8'),
(21, 2, 8, 'Fin de semana de descanso', 'En un fin de semana libre, el equipo descubre un crimen y lo resuelve al estilo Sherlock Holmes.', 57, 'https://ok.ru/video/7289262508682', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgYjc-QC4h7A6wiI7NDAvtnAqXMb4yGxToZXviZQIyKHWU&fn=external_8'),
(22, 2, 9, 'El debilitador social', 'Una modelo confronta al dueño de su agencia. Los Simuladores organizan un falso juicio en la ONU por ''precrímenes contra la humanidad''.', 69, 'https://ok.ru/video/7289262115466', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgYdDG0yH4LvfiOXLOlnLrZFz5vaNnXplDXsd1FGvExfP0&fn=external_8'),
(23, 2, 10, 'El anillo de Salomón', 'Un famoso director de orquesta necesita deshacerse de un fanático obsesivo. Los Simuladores se encargan del caso.', 58, 'https://ok.ru/video/9602281376394', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgYTHM79n_vjDfdlbG_kKSJDSSCs-Cl1AoJjYQsYBWCmLY&fn=external_8'),
(24, 2, 11, 'Episodio final', 'Franco Milazzo regresa para vengarse. El equipo también convence a un empleado corporativo de volver al negocio familiar. El último trabajo de Los Simuladores… por un tiempo.', 109, 'https://ok.ru/video/7289262574218', 'https://iv.okcdn.ru/i?r=BDFSTM1h2o92P_v-s8DgGlgYcGP7A0zDjfKr3uNHjRHPl19GU1U5DfQiyB6OO0iuEuI&fn=external_8')
on conflict (id) do update set
  season = excluded.season,
  number = excluded.number,
  title = excluded.title,
  description = excluded.description,
  duration = excluded.duration,
  url = excluded.url,
  thumb = excluded.thumb,
  updated_at = now();
