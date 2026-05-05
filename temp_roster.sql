WITH
del AS (
  DELETE FROM tactics_notes
  WHERE category = 'servers' AND title IS NULL
  RETURNING id
),
roster_raw(team_key, player_name, jersey, position, nationality) AS (
  VALUES
  -- VOREAS HOKKAIDO
  ('voreas','Nakamichi Manato','2','Outside','Japan'),
  ('voreas','Kunikyo Takumi','3','Setter','Japan'),
  ('voreas','Matsushita Hyuga','4','Middle','Japan'),
  ('voreas','Inoue Jin','5','Middle','Japan'),
  ('voreas','Yamagishi Jun','6','Setter','Japan'),
  ('voreas','Higuruma Kyosuke','8','Outside','Japan'),
  ('voreas','Ikeda Kota','9','Outside','Japan'),
  ('voreas','Mart Tammearu','10','Outside','Estonia'),
  ('voreas','Tonozaki Kohei','11','Libero','Japan'),
  ('voreas','Arao Reon','12','Libero','Japan'),
  ('voreas','Chang Yu-Sheng','14','Opposite','Taiwan'),
  ('voreas','Deguchi Taisei','15','Middle','Japan'),
  ('voreas','Koga Kenta','18','Opposite','Japan'),
  ('voreas','Hamada Shota','19','Setter','Japan'),
  ('voreas','Someno Hikaru','20','Outside','Japan'),
  ('voreas','Miyoshi Keisuke','34','Middle','Japan'),
  ('voreas','Timo Tammemaa','44','Middle','Estonia'),
  -- TOKYO GREAT BEARS
  ('tokyo','Bartosz Kurek','1','Opposite','Poland'),
  ('tokyo','Fukatsu Akihiro','3','Setter','Japan'),
  ('tokyo','Jan Kozamernik','4','Middle','Slovenia'),
  ('tokyo','Taniguchi Wataru','5','Libero','Japan'),
  ('tokyo','Alex Ferreira','6','Outside','Brazil'),
  ('tokyo','Yanagida Masahiro','8','Outside','Japan'),
  ('tokyo','Tozaki Takahiro','9','Outside','Japan'),
  ('tokyo','Koga Taichiro','10','Libero','Japan'),
  ('tokyo','Murayama Go','12','Middle','Japan'),
  ('tokyo','Otake Issei','13','Middle','Japan'),
  ('tokyo','Imahashi Yuki','15','Setter','Japan'),
  ('tokyo','Luciano Vicentin','17','Outside','Brazil'),
  ('tokyo','Goto Rikuto','25','Outside','Japan'),
  ('tokyo','Ito Riku','26','Middle','Japan'),
  ('tokyo','Ohmae Ryuki','29','Libero','Japan'),
  ('tokyo','Kawano Takuma','30','Outside','Japan'),
  ('tokyo','Kondo Ranmaru','32','Setter','Japan'),
  ('tokyo','Takashima Yusaku','39','Opposite','Japan'),
  -- VC NAGANO TRIDENTS
  ('nagano','Yamada Koki','1','Middle','Japan'),
  ('nagano','Fujisawa Keiichiro','2','Libero','Japan'),
  ('nagano','Sakai Shusuke','3','Opposite','Japan'),
  ('nagano','Chiba Kanze','4','Middle','Japan'),
  ('nagano','Nanba Koji','5','Libero','Japan'),
  ('nagano','Akahoshi Shinjo','6','Setter','Japan'),
  ('nagano','Kotoh Hiroki','7','Libero','Japan'),
  ('nagano','Nakashima Kento','8','Setter','Japan'),
  ('nagano','Fujiwara Shota','9','Outside','Japan'),
  ('nagano','Yasuhara Dai','10','Middle','Japan'),
  ('nagano','Kudo Yuji','11','Outside','Japan'),
  ('nagano','Hoshina Yusuke','12','Setter','Japan'),
  ('nagano','Iida Koga','13','Opposite','Japan'),
  ('nagano','Matthew Neaves','14','Opposite','Australia'),
  ('nagano','Matsumoto Yoshihiko','17','Middle','Japan'),
  ('nagano','Sato Ryuya','18','Outside','Japan'),
  ('nagano','Ichijo Takamaru','19','Outside','Japan'),
  ('nagano','Kishikawa Hazuki','21','Opposite','Japan'),
  ('nagano','Oskar Madsen','22','Outside','Denmark'),
  ('nagano','Abe Shodai','24','Middle','Japan'),
  ('nagano','Farhan Halim','26','Outside','Indonesia'),
  ('nagano','Isowaki Yuma','30','Libero','Japan'),
  -- TORAY ARROWS SHIZUOKA
  ('toray','Namba Takahiro','1','Middle','Japan'),
  ('toray','Shin Takahiro','2','Setter','Japan'),
  ('toray','Yamaguchi Takumi','3','Libero','Japan'),
  ('toray','Sakai Keisuke','4','Setter','Japan'),
  ('toray','Kusumoto Gaku','6','Outside','Japan'),
  ('toray','Fujinaka Yuto','8','Outside','Japan'),
  ('toray','Mawatari Takumi','9','Outside','Japan'),
  ('toray','Shigeto Tobiastakeshi','10','Outside','Japan'),
  ('toray','Kirill Klets','11','Opposite','Russia'),
  ('toray','Yamada Daiki','12','Outside','Japan'),
  ('toray','Taylor Averill','13','Middle','USA'),
  ('toray','Ri Haku','15','Middle','Japan'),
  ('toray','Kamijo Reimondo','16','Middle','Japan'),
  ('toray','Ozawa Hiroki','17','Outside','Japan'),
  ('toray','Maki Hiroaki','18','Outside','Japan'),
  ('toray','Takeda Taishu','19','Libero','Japan'),
  ('toray','Onodera Eiki','20','Setter','Japan'),
  ('toray','Nakamura Ryusuke','22','Middle','Japan'),
  ('toray','Julio Cardenas','24','Outside','Cuba'),
  -- JTEKT STINGS AICHI
  ('jtekt','Lu Chiang Yao-Kai','1','Middle','Taiwan'),
  ('jtekt','Takahashi Kentaro','2','Middle','Japan'),
  ('jtekt','Sakai Sayato','3','Middle','Japan'),
  ('jtekt','Kawaguchi Shuto','4','Middle','Japan'),
  ('jtekt','Kawahigashi Yudai','6','Setter','Japan'),
  ('jtekt','Araki Takuma','7','Libero','Japan'),
  ('jtekt','Stephen Boyer','9','Opposite','France'),
  ('jtekt','Fujinaka Kenya','10','Outside','Japan'),
  ('jtekt','Hata Kosuke','11','Outside','Japan'),
  ('jtekt','Fujiwara Naoya','12','Outside','Japan'),
  ('jtekt','Demizu Mitsuki','16','Opposite','Japan'),
  ('jtekt','Maeda Issei','17','Setter','Japan'),
  ('jtekt','Takahashi Kazuyuki','21','Libero','Japan'),
  ('jtekt','Iwamoto Daigo','22','Middle','Japan'),
  ('jtekt','Torey DeFalco','23','Outside','USA'),
  ('jtekt','Ricardo Lucarelli','26','Outside','Brazil'),
  -- WOLFDOGS NAGOYA
  ('wolfdogs','Yamada Shuzo','1','Outside','Japan'),
  ('wolfdogs','Sawada Akira','2','Middle','Japan'),
  ('wolfdogs','Fukatsu Hideomi','3','Setter','Japan'),
  ('wolfdogs','Yamazaki Masahiro','4','Middle','Japan'),
  ('wolfdogs','Watanabe Shunsuke','5','Libero','Japan'),
  ('wolfdogs','Timothee Carle','6','Outside','France'),
  ('wolfdogs','Hayasaka Shinnosuke','7','Setter','Japan'),
  ('wolfdogs','Maeda Ryogo','8','Setter','Japan'),
  ('wolfdogs','Aymen Bouguerra','9','Outside','Algeria'),
  ('wolfdogs','Sato Shunichiro','10','Middle','Japan'),
  ('wolfdogs','Denda Ryota','11','Middle','Japan'),
  ('wolfdogs','Mizumachi Taito','12','Outside','Japan'),
  ('wolfdogs','Miyaura Kento','15','Opposite','Japan'),
  ('wolfdogs','Ichikawa Kenta','17','Libero','Japan'),
  ('wolfdogs','Kambayashi Naozumi','18','Setter','Japan'),
  ('wolfdogs','Toyoda Jo','22','Opposite','Japan'),
  ('wolfdogs','Yamazaki Akito','26','Outside','Japan'),
  ('wolfdogs','Norbert Huber','99','Middle','Austria'),
  -- OSAKA BLUTEON
  ('bluteon','Shimizu Kunihiro','1','Opposite','Japan'),
  ('bluteon','Nakamura Shunsuke','3','Setter','Japan'),
  ('bluteon','Kaneta Kotaro','4','Middle','Japan'),
  ('bluteon','Tomita Shoma','5','Outside','Japan'),
  ('bluteon','Antoine Brizard','6','Setter','France'),
  ('bluteon','Nakamoto Kenyu','8','Outside','Japan'),
  ('bluteon','Peng Shikun','9','Middle','China'),
  ('bluteon','Yamauchi Akihiro','10','Middle','Japan'),
  ('bluteon','Nishida Yuji','11','Opposite','Japan'),
  ('bluteon','Nozoe Ryo','12','Setter','Japan'),
  ('bluteon','Yamamoto Tomohiro','13','Libero','Japan'),
  ('bluteon','Kai Masato','15','Outside','Japan'),
  ('bluteon','Ikeshiro Kotaro','16','Libero','Japan'),
  ('bluteon','Nishiyama Hiroto','18','Opposite','Japan'),
  ('bluteon','Nishikawa Keitaro','19','Middle','Japan'),
  ('bluteon','Bryan Bagunas','22','Outside','Philippines'),
  ('bluteon','Larry IK Evbade-Dan','23','Middle','Nigeria'),
  ('bluteon','Miguel Lopez','81','Outside','Argentina'),
  -- SUNTORY SUNBIRDS OSAKA
  ('suntory','Onodera Taishi','1','Middle','Japan'),
  ('suntory','Sato Kenji','2','Middle','Japan'),
  ('suntory','Shimokawa Ryo','5','Setter','Japan'),
  ('suntory','Alain Dearmas','7','Outside','Cuba'),
  ('suntory','Sekita Masahiro','8','Setter','Japan'),
  ('suntory','Ogawa Tomohiro','10','Libero','Japan'),
  ('suntory','Fujinaka Soshi','11','Libero','Japan'),
  ('suntory','Takahashi Ran','12','Outside','Japan'),
  ('suntory','Dmitriy Muserskiy','13','Opposite','Russia'),
  ('suntory','Oniki Ren','14','Middle','Japan'),
  ('suntory','Kiire Yoshimitsu','15','Libero','Japan'),
  ('suntory','Kashimura Hirohito','17','Middle','Japan'),
  ('suntory','Egor Kliuka','18','Outside','Russia'),
  ('suntory','Kai Kotaro','19','Opposite','Japan'),
  ('suntory','Takahashi Rui','21','Outside','Japan'),
  ('suntory','Kuwada Kenshin','22','Outside','Japan'),
  ('suntory','Kashiwada Tatsuki','23','Middle','Japan'),
  -- NIPPON STEEL SAKAI BLAZERS
  ('sakai','Matthew Anderson','1','Opposite','USA'),
  ('sakai','Yamane Hiroyuki','2','Middle','Japan'),
  ('sakai','Yasui Kosuke','3','Outside','Japan'),
  ('sakai','Takano Naoya','4','Outside','Japan'),
  ('sakai','Horie Tomohiro','5','Libero','Japan'),
  ('sakai','Mori Aiki','6','Libero','Japan'),
  ('sakai','Takanashi Kenta','7','Outside','Japan'),
  ('sakai','Akima Naoto','8','Middle','Japan'),
  ('sakai','Tsai Peichang','9','Middle','Taiwan'),
  ('sakai','Watanabe Cole','10','Middle','USA'),
  ('sakai','Oya Masaki','11','Setter','Japan'),
  ('sakai','Ulrik Dahl','14','Opposite','Norway'),
  ('sakai','Eto Takumi','15','Setter','Japan'),
  ('sakai','Kamimura Ryunosuke','17','Opposite','Japan'),
  ('sakai','Nakanishi Takehiro','20','Setter','Japan'),
  ('sakai','Takemoto Yutaro','21','Middle','Japan'),
  ('sakai','Kakizaki Akira','22','Outside','Japan'),
  ('sakai','Minamiguchi Tatsuki','23','Libero','Japan'),
  ('sakai','Tommaso Rinaldi','90','Outside','Italy'),
  -- HIROSHIMA THUNDERS
  ('thunders','Yanakita Yuri','1','Outside','Japan'),
  ('thunders','Higuchi Yuki','2','Middle','Japan'),
  ('thunders','Nishimura Makoto','3','Libero','Japan'),
  ('thunders','Miwa Hiromasa','4','Middle','Japan'),
  ('thunders','Inoue Shinichiro','5','Outside','Japan'),
  ('thunders','Cooper Robinson','6','Outside','USA'),
  ('thunders','Arai Yudai','7','Outside','Japan'),
  ('thunders','Takechi Koshi','8','Outside','Japan'),
  ('thunders','Takanashi Kaiki','9','Middle','Japan'),
  ('thunders','Takaki Keishiro','10','Libero','Japan'),
  ('thunders','Sakashita Junya','11','Outside','Japan'),
  ('thunders','Nishimoto Keigo','15','Middle','Japan'),
  ('thunders','Nishi Chihiro','16','Middle','Japan'),
  ('thunders','Kaneko Masaki','17','Setter','Japan'),
  ('thunders','Yamamoto Shohei','18','Outside','Japan'),
  ('thunders','Felipe Moreira Roque','19','Opposite','Brazil'),
  ('thunders','Abe Daiki','20','Setter','Japan'),
  ('thunders','Eiro Motoki','21','Setter','Japan'),
  ('thunders','Yamamoto Hayato','22','Outside','Japan'),
  ('thunders','Daniel Martinez Campos','23','Opposite','Spain')
),
team_map(team_key, team_id) AS (
  SELECT 'voreas',   id FROM tactics_teams WHERE lower(name) LIKE '%voreas%'
  UNION ALL SELECT 'tokyo',    id FROM tactics_teams WHERE lower(name) LIKE '%tokyo%'
  UNION ALL SELECT 'nagano',   id FROM tactics_teams WHERE lower(name) LIKE '%nagano%'
  UNION ALL SELECT 'toray',    id FROM tactics_teams WHERE lower(name) LIKE '%toray%'
  UNION ALL SELECT 'jtekt',    id FROM tactics_teams WHERE lower(name) LIKE '%jtekt%'
  UNION ALL SELECT 'wolfdogs', id FROM tactics_teams WHERE lower(name) LIKE '%wolfdogs%'
  UNION ALL SELECT 'bluteon',  id FROM tactics_teams WHERE lower(name) LIKE '%bluteon%'
  UNION ALL SELECT 'suntory',  id FROM tactics_teams WHERE lower(name) LIKE '%suntory%'
  UNION ALL SELECT 'sakai',    id FROM tactics_teams WHERE lower(name) LIKE '%sakai%'
  UNION ALL SELECT 'thunders', id FROM tactics_teams WHERE lower(name) LIKE '%thunders%'
),
all_entries(team_id, category, title, jersey, position, nationality) AS (
  SELECT tm.team_id, 'roster', r.player_name, r.jersey, r.position, r.nationality
  FROM roster_raw r JOIN team_map tm ON r.team_key = tm.team_key
  UNION ALL
  SELECT tm.team_id, 'servers', r.player_name, r.jersey, r.position, NULL
  FROM roster_raw r JOIN team_map tm ON r.team_key = tm.team_key
  UNION ALL
  SELECT tm.team_id, 'setters', r.player_name, r.jersey, r.position, NULL
  FROM roster_raw r JOIN team_map tm ON r.team_key = tm.team_key
  WHERE r.position = 'Setter'
  UNION ALL
  SELECT tm.team_id, 'spikers', r.player_name, r.jersey, r.position, NULL
  FROM roster_raw r JOIN team_map tm ON r.team_key = tm.team_key
  WHERE r.position IN ('Middle', 'Outside', 'Opposite', 'Universal')
)
INSERT INTO tactics_notes (team_id, category, title, jersey, position, nationality, author_name)
SELECT team_id, category, title, jersey, position, nationality, ''
FROM all_entries;
