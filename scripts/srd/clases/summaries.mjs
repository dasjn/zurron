// Resúmenes para jugadores novatos (texto propio, no del SRD).
// Claves = id final del rasgo (con sufijo -nN si el rasgo se repite).
// Los rasgos genéricos repetidos (Mejora de característica, Rasgo de subclase,
// Don épico, Subclase, Ataque adicional, ampliaciones de Maestría con armas,
// Invocaciones, Metamagia...) se resumen con genericSummary().

export const CLASS_SUMMARIES = {
  barbaro:
    'Guerrero salvaje que entra en furia para aguantar golpes y pegar más fuerte; ideal si quieres estar en primera línea sin complicarte.',
  bardo:
    'Artista mágico que inspira a sus aliados, lanza conjuros con su Carisma y se le da bien casi todo fuera del combate.',
  brujo:
    'Lanzador que obtiene su magia de un pacto con un ser poderoso: pocos espacios de conjuro que vuelven con un descanso corto y poderes permanentes llamados invocaciones.',
  clerigo:
    'Sacerdote con magia divina que cura, protege y castiga con el poder de su dios; el sanador más fiable del grupo.',
  druida:
    'Guardián de la naturaleza que lanza conjuros con su Sabiduría y puede transformarse en animales.',
  explorador:
    'Cazador y rastreador de tierras salvajes que combina las armas (sobre todo a distancia) con un poco de magia de la naturaleza.',
  guerrero:
    'Experto en armas y armaduras, la clase más sencilla y resistente: ataca muchas veces y tiene trucos para recuperarse en mitad del combate.',
  hechicero:
    'Lanzador con la magia en la sangre que puede retorcer sus conjuros (metamagia) gastando puntos de hechicería.',
  mago: 'Estudioso de la magia arcana con el mayor repertorio de conjuros del juego, guardados en su libro de conjuros.',
  monje:
    'Artista marcial rápido que lucha sin armadura a puñetazos y patadas, gastando puntos de concentración en técnicas especiales.',
  paladin:
    'Guerrero sagrado con armadura pesada que combina golpes poderosos con curación y auras que protegen a sus aliados.',
  picaro:
    'Experto en sigilo y habilidades que hace mucho daño con su ataque furtivo y sabe escabullirse del peligro.',
}

export const SUBCLASS_SUMMARIES = {
  'senda-del-berserker': 'Bárbaro de furia desatada: hace más daño cuando ataca temerariamente y no se deja asustar ni hechizar.',
  'colegio-del-conocimiento':
    'Bardo erudito: más habilidades, conjuros de otras clases y la capacidad de estropear las tiradas enemigas con Palabras cortantes.',
  'patron-infernal': 'Brujo con un pacto con un demonio o diablo: gana PG temporales al tumbar enemigos y conjuros de fuego.',
  'dominio-de-la-vida': 'Clérigo sanador: sus curaciones curan más y siempre tiene preparados conjuros de curación.',
  'circulo-de-la-tierra':
    'Druida ligado a un tipo de terreno que le da conjuros extra; además recupera espacios de conjuro al descansar.',
  cazador: 'Explorador especializado en abatir enemigos, con tácticas de ataque y defensa que puede cambiar al descansar.',
  campeon: 'Guerrero sencillo y eficaz: hace críticos más a menudo y cada vez es más difícil de tumbar.',
  'hechiceria-draconica':
    'Hechicero con sangre de dragón: más PG, escamas que le protegen, afinidad con un elemento y alas a nivel alto.',
  evocador: 'Mago experto en conjuros de daño elemental, capaz de proteger a sus aliados de sus propias explosiones.',
  'guerrero-de-la-mano-abierta': 'Monje maestro del combate sin armas que derriba y empuja a sus enemigos con sus golpes.',
  'juramento-de-entrega':
    'Paladín de caballero clásico: arma sagrada, aura que impide los hechizos de control y conjuros de protección.',
  ladron: 'Pícaro aventurero clásico: manos rápidas, gran trepador y experto en usar objetos mágicos.',
}

export const FEATURE_SUMMARIES = {
  // --- Bardo -------------------------------------------------------------------
  'bardo-inspiracion-bardica':
    'Como acción adicional, das a un aliado que te vea u oiga (a 18 m o menos) un dado de inspiración (d6 al principio). Durante la hora siguiente, si falla una tirada de d20, puede tirarlo y sumarlo para intentar convertir el fallo en éxito. Tienes tantos usos como tu modificador por Carisma (mínimo 1).',
  'bardo-lanzamiento-de-conjuros':
    'Lanzas conjuros de bardo usando Carisma, con un instrumento musical como canalizador. Tus trucos se usan sin límite; el resto de conjuros preparados gastan espacios de conjuro, que recuperas con un descanso largo. Al subir de nivel puedes cambiar un truco y un conjuro preparado.',
  'bardo-aprendiz-de-mucho':
    'Sumas la mitad de tu bonificador por competencia (redondeando hacia abajo) a las pruebas de habilidades en las que no eres competente. Funciona solo, no tienes que activarlo.',
  'bardo-pericia-n2':
    'Eliges dos habilidades en las que ya seas competente: a partir de ahora sumas el doble de tu bonificador por competencia en ellas. Elige las que más vayas a usar, como Persuasión o Interpretación.',
  'bardo-pericia-n9': 'Eliges otras dos habilidades en las que seas competente para tener pericia en ellas (doble bonificador por competencia).',
  'bardo-fuente-de-inspiracion':
    'Ahora recuperas todos los usos de Inspiración bárdica también con un descanso corto. Y si te quedas sin ellos, puedes gastar un espacio de conjuro para recuperar uno.',
  'bardo-contraencantamiento':
    'Si tú o una criatura a 9 m o menos falláis una tirada de salvación contra quedar asustado o hechizado, puedes usar tu reacción para que la repita con ventaja.',
  'bardo-secretos-magicos':
    'Cuando ganes conjuros preparados nuevos, puedes elegirlos también de las listas de clérigo, druida y mago. Aprovecha para coger lo que le falte al grupo, como curación potente o conjuros de daño.',
  'bardo-inspiracion-superior':
    'Cuando tiras iniciativa, si te quedan menos de dos usos de Inspiración bárdica, recuperas hasta tener dos.',
  'bardo-palabras-de-creacion':
    'Siempre tienes preparados palabra de poder: sanar y palabra de poder: matar, y al lanzarlos puedes afectar también a una segunda criatura a 3 m o menos de la primera.',
  'colegio-del-conocimiento-competencias-adicionales': 'Ganas competencia en tres habilidades que elijas.',
  'colegio-del-conocimiento-palabras-cortantes':
    'Cuando una criatura que veas a 18 m o menos haga una tirada de daño o tenga éxito en una prueba o un ataque, puedes usar tu reacción y un uso de Inspiración bárdica para restarle tu dado bárdico. Úsalo para librar a un aliado de un golpe fuerte o hacer fallar a un enemigo.',
  'colegio-del-conocimiento-descubrimientos-magicos':
    'Aprendes dos conjuros de las listas de clérigo, druida o mago (trucos o de un nivel que puedas lanzar). Siempre los tienes preparados y no cuentan para tu límite.',
  'colegio-del-conocimiento-habilidad-sin-parangon':
    'Si fallas una prueba de característica o una tirada de ataque, puedes gastar un uso de Inspiración bárdica y sumar el dado a tu tirada. Si aun así fallas, no pierdes el uso.',

  // --- Guerrero ----------------------------------------------------------------
  'guerrero-estilo-de-combate':
    'Eliges una dote de estilo de combate, por ejemplo Defensa (+1 a la CA si llevas armadura). Puedes cambiarla por otra cada vez que subes de nivel.',
  'guerrero-maestria-con-armas-n1':
    'Eliges tres tipos de armas cuya propiedad de maestría puedes usar: efectos extra al atacar, como derribar, empujar o ralentizar. Tras cada descanso largo puedes cambiar una elección.',
  'guerrero-tomar-aliento':
    'Como acción adicional, recuperas 1d10 + tu nivel de guerrero en puntos de golpe. Úsalo cuando estés herido en mitad del combate; recuperas un uso con cada descanso corto y todos con un descanso largo.',
  'guerrero-accion-subita':
    'Una vez por descanso corto o largo, en tu turno puedes hacer una acción más (cualquiera salvo la acción de magia), por ejemplo volver a atacar. Guárdala para el momento clave del combate.',
  'guerrero-mente-tactica':
    'Cuando falles una prueba de característica, puedes gastar un uso de Tomar aliento para sumar 1d10 a la tirada. Si aun así fallas, no pierdes el uso.',
  'guerrero-ataque-adicional': 'Cuando haces la acción de atacar en tu turno, atacas dos veces en lugar de una.',
  'guerrero-desplazamiento-tactico':
    'Cuando usas Tomar aliento, también puedes moverte hasta la mitad de tu velocidad sin provocar ataques de oportunidad. Úsalo para curarte y salir de un apuro.',
  'guerrero-indomito':
    'Si fallas una tirada de salvación, puedes repetirla sumando tu nivel de guerrero, y te quedas con el nuevo resultado. Una vez por descanso largo (dos desde el nivel 13 y tres desde el 17).',
  'guerrero-maestro-tactico':
    'Al atacar con un arma cuya maestría dominas, puedes cambiar su efecto por debilitar, empujar o ralentizar solo para ese ataque. Elige el que mejor encaje en cada momento.',
  'guerrero-dos-ataques-adicionales': 'Cuando haces la acción de atacar en tu turno, atacas tres veces en lugar de una.',
  'guerrero-ataques-estudiados':
    'Si fallas un ataque contra una criatura, tendrás ventaja en tu siguiente ataque contra ella antes de que acabe tu siguiente turno.',
  'guerrero-tres-ataques-adicionales': 'Cuando haces la acción de atacar en tu turno, atacas cuatro veces en lugar de una.',
  'campeon-atleta-sobresaliente':
    'Tienes ventaja en la iniciativa y en las pruebas de Fuerza (Atletismo). Además, justo después de hacer un crítico puedes moverte hasta la mitad de tu velocidad sin provocar ataques de oportunidad.',
  'campeon-critico-mejorado': 'Tus ataques con armas y sin armas son críticos con un 19 o un 20 en el d20.',
  'campeon-estilo-de-combate-adicional': 'Eliges otra dote de estilo de combate.',
  'campeon-guerrero-heroico':
    'Durante un combate, si empiezas tu turno sin inspiración heroica, la obtienes gratis. Úsala para repetir una tirada que te haya salido mal.',
  'campeon-critico-superior': 'Tus ataques con armas y sin armas son críticos con un 18, 19 o 20 en el d20.',
  'campeon-superviviente':
    'Tienes ventaja en las tiradas de salvación contra muerte, y un 18-20 cuenta como un 20. Además, si estás maltrecho (a la mitad de PG o menos) pero con al menos 1 PG, recuperas 5 + tu modificador por Constitución al principio de cada turno.',

  // --- Hechicero ---------------------------------------------------------------
  'hechicero-lanzamiento-de-conjuros':
    'Lanzas conjuros de hechicero usando Carisma. Empiezas con cuatro trucos (uso ilimitado) y preparas conjuros que gastan espacios de conjuro, que recuperas con un descanso largo. Al subir de nivel puedes cambiar un truco y un conjuro preparado.',
  'hechicero-hechiceria-innata':
    'Como acción adicional, desatas tu magia durante 1 minuto: la CD de salvación de tus conjuros de hechicero sube 1 y tienes ventaja en sus tiradas de ataque. Dos usos por descanso largo; actívala al empezar un combate difícil.',
  'hechicero-fuente-de-magia':
    'Tienes puntos de hechicería (tantos como tu nivel de hechicero) que recuperas con un descanso largo. Puedes gastar un espacio de conjuro para ganar puntos, o, como acción adicional, gastar puntos para crear un espacio de conjuro (mira la tabla).',
  'hechicero-metamagia-n2':
    'Eliges dos opciones de metamagia: formas de modificar tus conjuros gastando puntos de hechicería, como lanzarlos sin que se note (Conjuro sutil) o con más alcance (Conjuro distante). Puedes cambiar una al subir de nivel.',
  'hechicero-recuperacion-magica':
    'Una vez por descanso largo, al terminar un descanso corto recuperas puntos de hechicería hasta la mitad de tu nivel de hechicero (redondeando hacia abajo).',
  'hechicero-encarnacion-magica':
    'Si no te quedan usos de Hechicería innata, puedes activarla igualmente gastando 2 puntos de hechicería. Mientras está activa, puedes aplicar dos opciones de metamagia al mismo conjuro.',
  'hechicero-apoteosis-arcana':
    'Mientras tienes activa la Hechicería innata, una vez en cada uno de tus turnos puedes usar una opción de metamagia sin gastar puntos de hechicería.',
  'hechiceria-draconica-conjuros-draconicos':
    'Siempre tienes preparados ciertos conjuros de temática dracónica, que no cuentan para tu límite. Ganas más en los niveles 5, 7 y 9.',
  'hechiceria-draconica-resistencia-draconica':
    'Tus PG máximos aumentan en 3, y en 1 más cada vez que subes de nivel de hechicero. Además, sin armadura tu CA base es 10 + Destreza + Carisma.',
  'hechiceria-draconica-afinidad-elemental':
    'Eliges un tipo de daño (ácido, frío, fuego, relámpago o veneno): tienes resistencia a él y, cuando un conjuro tuyo haga ese daño, sumas tu modificador por Carisma a una de sus tiradas de daño.',
  'hechiceria-draconica-alas-de-dragon':
    'Como acción adicional, te salen alas de dragón durante 1 hora y tienes velocidad volando de 18 m. Una vez por descanso largo, o gastando 3 puntos de hechicería para volver a usarlo.',
  'hechiceria-draconica-companero-dragon':
    'Puedes lanzar invocar dragón sin componente material, una vez gratis por descanso largo. Si quieres, el conjuro no requiere concentración (y entonces dura 1 minuto).',

  // --- Paladín -----------------------------------------------------------------
  'paladin-imponer-las-manos':
    'Tienes una reserva de curación de 5 PG por nivel de paladín que se rellena con un descanso largo. Como acción adicional, tocas a una criatura (o a ti) y le curas los PG que quieras de esa reserva; gastando 5 puntos también puedes quitarle el estado envenenado.',
  'paladin-lanzamiento-de-conjuros':
    'Lanzas conjuros de paladín usando Carisma, con un símbolo sagrado como canalizador. Tus conjuros preparados gastan espacios de conjuro, que recuperas con un descanso largo; tras cada descanso largo puedes cambiar uno de los preparados.',
  'paladin-maestria-con-armas':
    'Eliges dos tipos de armas cuya propiedad de maestría puedes usar (efectos extra al atacar, como derribar o ralentizar). Puedes cambiarlos tras cada descanso largo.',
  'paladin-castigo-de-paladin':
    'Siempre tienes preparado castigo divino (daño radiante extra justo después de acertar un ataque) y puedes lanzarlo gratis, sin gastar espacio, una vez por descanso largo. Guárdalo para un golpe importante.',
  'paladin-estilo-de-combate':
    'Eliges una dote de estilo de combate o, en su lugar, Guerrero bendito: aprendes dos trucos de clérigo que lanzas con Carisma.',
  'paladin-canalizar-divinidad':
    'Tienes usos de Canalizar divinidad (dos, y tres desde el nivel 11): recuperas uno con un descanso corto y todos con uno largo. El primer efecto es Sentidos divinos: como acción adicional, durante 10 minutos detectas celestiales, infernales y muertos vivientes a 18 m o menos.',
  'paladin-ataque-adicional': 'Cuando haces la acción de atacar en tu turno, atacas dos veces en lugar de una.',
  'paladin-corcel-fiel':
    'Siempre tienes preparado hallar corcel, que invoca una montura sobrenatural, y puedes lanzarlo gratis una vez por descanso largo.',
  'paladin-aura-de-proteccion':
    'Tú y tus aliados a 3 m o menos sumáis tu modificador por Carisma (mínimo +1) a todas las tiradas de salvación. Mantén a tus compañeros cerca de ti.',
  'paladin-abjurar-de-los-enemigos':
    'Como acción de magia, gastas un uso de Canalizar divinidad para intentar asustar a tantas criaturas como tu modificador por Carisma (a 18 m o menos). Las que fallen una salvación de Sabiduría quedan asustadas y en su turno solo pueden moverse, hacer una acción o hacer una acción adicional.',
  'paladin-aura-de-coraje': 'Tú y tus aliados dentro de tu Aura de protección no podéis quedar asustados.',
  'paladin-golpes-radiantes':
    'Tus ataques cuerpo a cuerpo con armas y tus ataques sin armas hacen 1d8 de daño radiante extra cada vez que aciertan.',
  'paladin-toque-reparador':
    'Al usar Imponer las manos, puedes gastar 5 PG de la reserva por cada estado que quieras quitar: asustado, aturdido, cegado, ensordecido, hechizado o paralizado.',
  'paladin-expansion-de-aura': 'Tu Aura de protección (y lo que depende de ella) llega ahora hasta 9 m.',
  'juramento-de-entrega-arma-sagrada':
    'Al hacer la acción de atacar, puedes gastar un uso de Canalizar divinidad para bendecir tu arma cuerpo a cuerpo durante 10 minutos: sumas tu Carisma a las tiradas de ataque con ella, puede hacer daño radiante y da luz.',
  'juramento-de-entrega-conjuros-del-juramento-de-entrega':
    'Siempre tienes preparados ciertos conjuros de protección y justicia, que no cuentan para tu límite. Ganas más en los niveles 5, 9, 13 y 17.',
  'juramento-de-entrega-aura-de-entrega': 'Tú y tus aliados dentro de tu Aura de protección no podéis quedar hechizados.',
  'juramento-de-entrega-castigo-protector':
    'Cuando lanzas castigo divino, tú y tus aliados dentro de tu Aura de protección tenéis cobertura media (+2 a la CA y a las salvaciones de Destreza) hasta el principio de tu siguiente turno.',
  'juramento-de-entrega-halo-sagrado':
    'Como acción adicional, durante 10 minutos tu aura daña a los enemigos que empiecen su turno en ella (Carisma + bonificador por competencia de daño radiante), da luz solar y te da ventaja en salvaciones contra infernales y muertos vivientes. Una vez por descanso largo, o gastando un espacio de nivel 5.',

  // --- Resto de clases, niveles 1-5 ---------------------------------------------
  'barbaro-defensa-sin-armadura': 'Sin armadura, tu CA es 10 + Destreza + Constitución (puedes llevar escudo).',
  'barbaro-furia':
    'Como acción adicional entras en furia (sin armadura pesada): resistencia al daño contundente, cortante y perforante, más daño en tus ataques de Fuerza y ventaja en pruebas y salvaciones de Fuerza, pero no puedes lanzar conjuros ni concentrarte. Se mantiene mientras sigas atacando (hasta 10 minutos); recuperas un uso con un descanso corto y todos con uno largo.',
  'barbaro-maestria-con-armas-n1':
    'Eliges dos tipos de armas cuerpo a cuerpo cuya propiedad de maestría puedes usar (efectos extra al atacar). Tras cada descanso largo puedes cambiar una elección.',
  'barbaro-ataque-temerario':
    'Al hacer tu primer ataque del turno, puedes atacar temerariamente: tienes ventaja en los ataques de Fuerza hasta tu siguiente turno, pero los ataques contra ti también tienen ventaja.',
  'barbaro-sentir-el-peligro': 'Tienes ventaja en las tiradas de salvación de Destreza (salvo si estás incapacitado).',
  'barbaro-conocimiento-primigenio':
    'Ganas competencia en otra habilidad de la lista del bárbaro. Además, en furia puedes hacer las pruebas de Acrobacias, Intimidación, Percepción, Sigilo o Supervivencia usando la Fuerza.',
  'barbaro-ataque-adicional': 'Cuando haces la acción de atacar en tu turno, atacas dos veces en lugar de una.',
  'barbaro-movimiento-rapido': 'Tu velocidad aumenta 3 m si no llevas armadura pesada.',
  'senda-del-berserker-frenesi':
    'Si usas Ataque temerario estando en furia, el primer objetivo al que aciertes con un ataque de Fuerza en tu turno recibe daño extra: tantos d6 como tu bonificador de daño por furia.',

  'brujo-invocaciones-sobrenaturales-n1':
    'Eliges una invocación sobrenatural: un poder mágico permanente, como Pacto del filo (un arma mágica que usa tu Carisma) o Mente sobrenatural (ventaja para mantener la concentración). Ganas más al subir de nivel, algunas solo a partir de cierto nivel, y puedes cambiar una cada vez.',
  'brujo-magia-del-pacto':
    'Lanzas conjuros de brujo con Carisma. Tienes pocos espacios de conjuro, pero todos son del nivel más alto que puedes lanzar y se recuperan con un descanso corto o largo, así que úsalos sin miedo.',
  'brujo-astucia-magica':
    'Una vez por descanso largo, con un rito de 1 minuto recuperas hasta la mitad (redondeando hacia arriba) de tus espacios de Magia del pacto gastados.',
  'patron-infernal-bendicion-del-oscuro':
    'Cuando reduces a 0 PG a un enemigo (o lo hace otra criatura a 3 m o menos de ti), ganas PG temporales iguales a tu modificador por Carisma + tu nivel de brujo.',
  'patron-infernal-conjuros-del-infernal':
    'Siempre tienes preparados ciertos conjuros de fuego y manipulación, que no cuentan para tu límite. Ganas más en los niveles 5, 7 y 9.',

  'clerigo-lanzamiento-de-conjuros':
    'Lanzas conjuros de clérigo con Sabiduría, usando un símbolo sagrado. Tus trucos se usan sin límite y tus conjuros preparados gastan espacios; tras cada descanso largo puedes cambiar los conjuros que tienes preparados.',
  'clerigo-orden-divina':
    'Eliges tu función: Protector (armas marciales y armadura pesada) o Taumaturgo (un truco extra y un bonificador a Conocimiento arcano y Religión).',
  'clerigo-canalizar-divinidad':
    'Tienes usos de Canalizar divinidad (recuperas uno con un descanso corto y todos con uno largo). Chispa divina cura o daña 1d8 + tu Sabiduría a una criatura a 9 m; Expulsar muertos vivientes hace huir a los muertos vivientes cercanos.',
  'clerigo-abrasar-muertos-vivientes':
    'Cuando usas Expulsar muertos vivientes, los que fallen la salvación reciben además daño radiante: tantos d8 como tu modificador por Sabiduría (mínimo 1d8).',
  'dominio-de-la-vida-conjuros-del-dominio-de-la-vida':
    'Siempre tienes preparados ciertos conjuros de curación, que no cuentan para tu límite. Ganas más en los niveles 5, 7 y 9.',
  'dominio-de-la-vida-discipulo-de-la-vida':
    'Cuando curas con un conjuro que gasta un espacio de conjuro, el objetivo recupera además 2 + el nivel del espacio en PG.',
  'dominio-de-la-vida-preservar-vida':
    'Como acción de magia, gastas un uso de Canalizar divinidad para repartir curación (cinco veces tu nivel de clérigo) entre criaturas maltrechas a 9 m o menos. No puede subir a nadie por encima de la mitad de sus PG máximos.',

  'druida-druidico': 'Conoces el druídico, el idioma secreto de los druidas, y siempre tienes preparado hablar con los animales.',
  'druida-lanzamiento-de-conjuros':
    'Lanzas conjuros de druida con Sabiduría, usando un canalizador druídico. Tus trucos se usan sin límite y tus conjuros preparados gastan espacios; tras cada descanso largo puedes cambiar los conjuros preparados.',
  'druida-orden-primigenia':
    'Eliges tu función: Guardián (armas marciales y armadura media) o Naturalista (un truco extra y un bonificador a Conocimiento arcano y Naturaleza).',
  'druida-companero-salvaje':
    'Como acción de magia, gastas un espacio de conjuro o un uso de Forma salvaje para lanzar encontrar familiar sin componentes materiales. El familiar es un espíritu feérico que dura hasta tu siguiente descanso largo.',
  'druida-forma-salvaje-n2':
    'Como acción adicional te transformas en una de las bestias que conoces (empiezas con cuatro) durante tantas horas como la mitad de tu nivel de druida. Ganas PG temporales iguales a tu nivel de druida y usas el perfil del animal, pero no puedes lanzar conjuros.',
  'druida-resurgimiento-salvaje':
    'Si no te quedan usos de Forma salvaje, puedes gastar un espacio de conjuro para recuperar uno. Y una vez por descanso largo puedes gastar un uso de Forma salvaje para obtener un espacio de conjuro de nivel 1.',
  'circulo-de-la-tierra-ayuda-de-la-tierra':
    'Como acción de magia, gastas un uso de Forma salvaje para crear una esfera de 3 m de radio a 18 m o menos: las criaturas que elijas hacen una salvación de Constitución o reciben 2d6 de daño necrótico (la mitad si la superan), y una criatura que elijas recupera 2d6 PG.',
  'circulo-de-la-tierra-conjuros-del-circulo-de-la-tierra':
    'Tras cada descanso largo eliges un terreno (árido, polar, templado o tropical) y tienes siempre preparados sus conjuros para tu nivel, sin que cuenten para tu límite.',

  'explorador-enemigo-predilecto':
    'Siempre tienes preparado marca del cazador (daño extra contra un objetivo marcado) y puedes lanzarlo gratis varias veces por descanso largo (dos al principio).',
  'explorador-lanzamiento-de-conjuros':
    'Lanzas conjuros de explorador con Sabiduría. Tus conjuros preparados gastan espacios de conjuro, que recuperas con un descanso largo; tras cada descanso largo puedes cambiar uno de los preparados.',
  'explorador-maestria-con-armas':
    'Eliges dos tipos de armas cuya propiedad de maestría puedes usar (efectos extra al atacar). Puedes cambiarlos tras cada descanso largo.',
  'explorador-estilo-de-combate':
    'Eliges una dote de estilo de combate (Tiro con arco es muy popular) o, en su lugar, Guerrero druídico: dos trucos de druida que lanzas con Sabiduría.',
  'explorador-explorador-habil':
    'Aprendes dos idiomas y ganas pericia (doble bonificador por competencia) en una habilidad en la que ya seas competente.',
  'explorador-ataque-adicional': 'Cuando haces la acción de atacar en tu turno, atacas dos veces en lugar de una.',
  'cazador-el-cazador-y-la-presa':
    'Eliges Azote de colosos (1d8 de daño extra una vez por turno contra objetivos que ya estén heridos) o Destructor de hordas (un ataque extra contra otra criatura cercana una vez por turno). Puedes cambiar tras un descanso.',
  'cazador-sabiduria-del-cazador':
    'Mientras una criatura tenga tu marca del cazador, sabes si tiene inmunidades, resistencias o vulnerabilidades y cuáles son.',

  'mago-lanzamiento-de-conjuros':
    'Lanzas conjuros de mago con Inteligencia. Tus conjuros están en tu libro de conjuros (añades dos gratis cada nivel) y tras cada descanso largo eliges cuáles tienes preparados; los espacios se recuperan con un descanso largo.',
  'mago-adepto-en-rituales':
    'Puedes lanzar como ritual (tarda 10 minutos más pero no gasta espacio) cualquier conjuro ritual de tu libro, aunque no lo tengas preparado.',
  'mago-recuperacion-arcana':
    'Una vez por descanso largo, al terminar un descanso corto recuperas espacios de conjuro gastados cuyos niveles sumen hasta la mitad de tu nivel de mago (redondeando hacia arriba), ninguno de nivel 6 o más.',
  'mago-academico':
    'Eliges una habilidad entre Conocimiento arcano, Historia, Investigación, Medicina, Naturaleza o Religión en la que seas competente y ganas pericia en ella.',
  'mago-memorizar-conjuro': 'Tras un descanso corto, puedes cambiar uno de tus conjuros preparados por otro de tu libro.',
  'evocador-experto-en-evocacion':
    'Añades gratis a tu libro dos conjuros de evocación de nivel 2 o menor, y otro de evocación cada vez que accedes a un nivel de espacios de conjuro nuevo.',
  'evocador-truco-potente':
    'Si fallas el ataque de un truco de daño o el objetivo supera su salvación, igualmente recibe la mitad del daño (pero no los efectos extra).',

  'monje-artes-marciales':
    'Sin armadura ni escudo, con ataques sin armas o armas de monje: puedes hacer un ataque sin armas como acción adicional, usar tu dado de Artes marciales (1d6 al principio) para el daño y usar Destreza en lugar de Fuerza.',
  'monje-defensa-sin-armadura': 'Sin armadura ni escudo, tu CA es 10 + Destreza + Sabiduría.',
  'monje-concentracion-de-monje':
    'Tienes puntos de concentración (tantos como tu nivel de monje) que recuperas con un descanso corto o largo. Con 1 punto puedes usar, como acción adicional, Ráfaga de golpes (dos ataques sin armas), Defensa paciente (destrabarte y esquivar) o Paso del viento (destrabarte y correr).',
  'monje-metabolismo-asombroso':
    'Una vez por descanso largo, al tirar iniciativa recuperas todos tus puntos de concentración y PG iguales a tu nivel de monje más una tirada de tu dado de Artes marciales.',
  'monje-movimiento-sin-armadura': 'Tu velocidad aumenta 3 m si no llevas armadura ni escudo, y aumenta más a niveles altos.',
  'monje-desviar-ataques':
    'Cuando un ataque te acierte con daño contundente, cortante o perforante, puedes usar tu reacción para reducir el daño en 1d10 + Destreza + nivel de monje. Si lo reduces a 0, puedes gastar 1 punto de concentración para devolver el golpe a otra criatura.',
  'monje-caida-lenta': 'Como reacción al caer, reduces el daño de la caída en cinco veces tu nivel de monje.',
  'monje-ataque-adicional': 'Cuando haces la acción de atacar en tu turno, atacas dos veces en lugar de una.',
  'monje-golpe-aturdidor':
    'Una vez por turno, al acertar con un arma de monje o un ataque sin armas, puedes gastar 1 punto de concentración: el objetivo hace una salvación de Constitución y, si falla, queda aturdido hasta tu siguiente turno (si la supera, queda ralentizado y es más fácil de golpear).',
  'guerrero-de-la-mano-abierta-tecnica-de-la-mano-abierta':
    'Cuando aciertas con un ataque de Ráfaga de golpes, puedes derribar al objetivo (salvación de Destreza), impedirle hacer ataques de oportunidad o empujarlo 4,5 m (salvación de Fuerza).',

  'picaro-ataque-furtivo':
    'Una vez por turno haces daño extra (1d6 al principio) a una criatura a la que aciertes con un arma sutil o a distancia, si tienes ventaja o si un aliado tuyo está a 1,5 m de ella (y no tienes desventaja).',
  'picaro-jerga-de-ladrones': 'Conoces la jerga de ladrones (un lenguaje secreto) y otro idioma de tu elección.',
  'picaro-maestria-con-armas':
    'Eliges dos tipos de armas cuya propiedad de maestría puedes usar (efectos extra al atacar). Puedes cambiarlos tras cada descanso largo.',
  'picaro-pericia-n1':
    'Eliges dos habilidades en las que seas competente para tener pericia (doble bonificador por competencia). Sigilo y Juego de manos son buenas opciones.',
  'picaro-pericia-n6': 'Eliges otras dos habilidades en las que seas competente para tener pericia en ellas.',
  'picaro-accion-astuta':
    'Puedes correr, destrabarte o esconderte como acción adicional. Ideal para atacar y luego alejarte o esconderte.',
  'picaro-punteria-certera':
    'Si no te has movido este turno, como acción adicional te das ventaja en tu siguiente ataque, pero tu velocidad pasa a 0 hasta el final del turno.',
  'picaro-golpe-astuto':
    'Al hacer daño de Ataque furtivo puedes renunciar a algunos dados para añadir un efecto: Retirada (te mueves sin provocar ataques), Tropiezo (derribas al objetivo) o Veneno (lo envenenas; necesitas útiles de envenenador).',
  'picaro-esquiva-asombrosa':
    'Cuando un atacante que puedas ver te acierte, puedes usar tu reacción para reducir a la mitad el daño de ese ataque.',
  'ladron-manos-rapidas':
    'Como acción adicional, puedes hacer una prueba de Destreza (Juego de manos) para robar, abrir una cerradura o desarmar una trampa, o usar un objeto (incluso uno mágico que necesite una acción).',
  'ladron-balconero': 'Ganas velocidad trepando igual a tu velocidad y puedes usar Destreza en lugar de Fuerza para calcular tus saltos.',

  // --- Resto de clases, niveles 6-20 (opcionales) ----------------------------------
  'barbaro-instinto-salvaje': 'Tienes ventaja en las tiradas de iniciativa.',
  'barbaro-salto-instintivo': 'Al entrar en furia con tu acción adicional, también puedes moverte hasta la mitad de tu velocidad.',
  'barbaro-golpe-brutal':
    'Cuando atacas temerariamente, puedes renunciar a la ventaja en un ataque de Fuerza: si aciertas, haces 1d10 de daño extra y empujas al objetivo 4,5 m (Golpe enérgico) o le reduces la velocidad 4,5 m (Golpe ralentizador).',
  'barbaro-furia-implacable':
    'Si caes a 0 PG estando en furia, haz una salvación de Constitución CD 10: si la superas, te quedas con PG iguales al doble de tu nivel de bárbaro. La CD sube 5 cada vez y vuelve a 10 tras un descanso.',
  'barbaro-golpe-brutal-mejorado-n13':
    'Añades dos efectos a Golpe brutal: Golpe abrumador (desventaja en su siguiente salvación y sin ataques de oportunidad) y Golpe desgarrador (+5 al siguiente ataque de otra criatura contra él).',
  'barbaro-furia-persistente':
    'Una vez por descanso largo, al tirar iniciativa recuperas todos los usos de furia. Además, tu furia dura 10 minutos sin tener que mantenerla atacando.',
  'barbaro-golpe-brutal-mejorado-n17': 'Tu Golpe brutal hace 2d10 de daño extra y puedes aplicar dos efectos distintos a la vez.',
  'barbaro-poderio-indomito':
    'Si sacas menos que tu puntuación de Fuerza en una prueba o salvación de Fuerza, puedes usar tu puntuación de Fuerza como resultado.',
  'barbaro-campeon-primordial': 'Tu Fuerza y tu Constitución aumentan en 4, hasta un máximo de 25.',
  'senda-del-berserker-furia-irracional':
    'Mientras estás en furia no puedes quedar asustado ni hechizado, y entrar en furia termina esos estados.',
  'senda-del-berserker-represalia':
    'Cuando una criatura a 1,5 m o menos te haga daño, puedes usar tu reacción para atacarla cuerpo a cuerpo.',
  'senda-del-berserker-presencia-intimidante':
    'Como acción adicional, las criaturas que elijas a 9 m o menos hacen una salvación de Sabiduría o quedan asustadas 1 minuto. Una vez por descanso largo, o gastando un uso de furia para repetirlo.',

  'brujo-contactar-patron':
    'Siempre tienes preparado contactar con otro plano y, una vez por descanso largo, lo lanzas gratis para hablar con tu patrón y superas automáticamente su salvación.',
  'brujo-maestro-sobrenatural': 'Cuando usas Astucia mágica recuperas todos tus espacios de Magia del pacto, no solo la mitad.',
  'patron-infernal-la-suerte-del-oscuro':
    'Cuando hagas una prueba de característica o una salvación, puedes sumar 1d10 después de ver el resultado. Tienes tantos usos como tu Carisma (mínimo 1) por descanso largo.',
  'patron-infernal-resistencia-infernal':
    'Tras cada descanso corto o largo eliges un tipo de daño (salvo fuerza) y tienes resistencia a él hasta que elijas otro.',
  'patron-infernal-arrastrar-por-el-infierno':
    'Una vez por turno, al acertar un ataque, puedes enviar al objetivo a los Planos Inferiores: si falla una salvación de Carisma, recibe 8d10 de daño psíquico (si no es un infernal) y vuelve al final de tu siguiente turno. Una vez por descanso largo, o gastando un espacio de Magia del pacto.',

  'clerigo-golpes-benditos':
    'Eliges Golpe divino (1d8 de daño necrótico o radiante extra una vez por turno al acertar con un arma) o Lanzamiento potente (sumas tu Sabiduría al daño de tus trucos de clérigo).',
  'clerigo-intercesion-divina':
    'Una vez por descanso largo, como acción de magia, lanzas gratis cualquier conjuro de clérigo de nivel 5 o menor (sin espacio ni componentes materiales).',
  'clerigo-golpes-benditos-mejorados':
    'Tu Golpe divino pasa a 2d8, o tu Lanzamiento potente también da PG temporales (el doble de tu Sabiduría) a ti o a un aliado cercano cuando dañas con un truco.',
  'clerigo-intercesion-divina-mayor':
    'Con Intercesión divina puedes lanzar incluso deseo; si lo haces, no podrás volver a usar Intercesión divina hasta pasados 2d4 descansos largos.',
  'dominio-de-la-vida-sanador-bendito':
    'Cuando curas a otros con un conjuro que gasta un espacio, tú también recuperas 2 + el nivel del espacio en PG.',
  'dominio-de-la-vida-sanacion-suprema':
    'Tus curaciones con conjuros o con Canalizar divinidad no se tiran: cada dado cuenta como su valor máximo.',

  'druida-furia-elemental':
    'Eliges Golpe primordial (1d8 de daño de frío, fuego, relámpago o trueno extra una vez por turno al acertar con un arma o en forma de bestia) o Lanzamiento potente (sumas tu Sabiduría al daño de tus trucos de druida).',
  'druida-furia-elemental-mejorada':
    'Tu Golpe primordial pasa a 2d8, o tus trucos de druida con alcance de 3 m o más ganan 90 m de alcance.',
  'druida-conjurar-como-bestia':
    'Puedes lanzar conjuros mientras estás en Forma salvaje (salvo los que tengan componentes materiales con coste o que se consumen).',
  'druida-archidruida':
    'Al tirar iniciativa, si no te quedan usos de Forma salvaje, recuperas uno. Una vez por descanso largo puedes convertir usos de Forma salvaje en un espacio de conjuro (2 niveles por uso). Además, envejeces diez veces más despacio.',
  'circulo-de-la-tierra-recuperacion-natural':
    'Una vez por descanso largo lanzas gratis uno de tus conjuros de círculo de nivel 1 o más. Y, una vez por descanso largo, al terminar un descanso corto recuperas espacios de conjuro (niveles que sumen hasta la mitad de tu nivel de druida, redondeando hacia arriba; ninguno de nivel 6 o más).',
  'circulo-de-la-tierra-proteccion-de-la-naturaleza':
    'No puedes quedar envenenado y tienes resistencia al daño del terreno que hayas elegido (árido: fuego; polar: frío; templado: relámpago; tropical: veneno).',
  'circulo-de-la-tierra-santuario-de-la-naturaleza':
    'Como acción de magia, gastas un uso de Forma salvaje para crear un cubo de árboles espectrales de 4,5 m durante 1 minuto: tú y tus aliados dentro tenéis cobertura media, y tus aliados ganan tu resistencia de Protección de la naturaleza.',

  'explorador-errante': 'Tu velocidad aumenta 3 m (sin armadura pesada) y ganas velocidad nadando y trepando iguales a tu velocidad.',
  'explorador-pericia': 'Eliges dos habilidades en las que seas competente para tener pericia en ellas (doble bonificador por competencia).',
  'explorador-infatigable':
    'Como acción de magia, te das 1d8 + Sabiduría PG temporales (tantas veces como tu Sabiduría por descanso largo). Además, cada descanso corto te quita un nivel de cansancio.',
  'explorador-cazador-persistente': 'Recibir daño ya no te hace perder la concentración en marca del cazador.',
  'explorador-velo-de-la-naturaleza':
    'Como acción adicional te vuelves invisible hasta el final de tu siguiente turno. Tantas veces como tu Sabiduría (mínimo 1) por descanso largo.',
  'explorador-cazador-preciso': 'Tienes ventaja en los ataques contra la criatura que tenga tu marca del cazador.',
  'explorador-sentidos-salvajes': 'Tienes visión ciega hasta 9 m: percibes lo que te rodea aunque no puedas verlo.',
  'explorador-azote-de-enemigos': 'El daño extra de tu marca del cazador pasa de d6 a d10.',
  'cazador-tacticas-defensivas':
    'Eliges Defensa contra ataques múltiples (quien te acierta tiene desventaja en sus demás ataques contra ti ese turno) o Escapar de la horda (los ataques de oportunidad contra ti tienen desventaja). Puedes cambiar tras un descanso.',
  'cazador-el-cazador-experto-y-la-presa':
    'Una vez por turno, al dañar a la criatura marcada con marca del cazador, puedes aplicar también su daño extra a otra criatura que veas a 9 m o menos de ella.',
  'cazador-defensa-de-cazador-experto':
    'Cuando recibes daño, puedes usar tu reacción para tener resistencia a ese daño y a cualquier otro del mismo tipo hasta el final del turno.',

  'mago-maestria-sobre-conjuros':
    'Eliges un conjuro de nivel 1 y otro de nivel 2 de tu libro (de una acción): siempre los tienes preparados y puedes lanzarlos a su nivel más bajo sin gastar espacios.',
  'mago-conjuros-caracteristicos':
    'Eliges dos conjuros de nivel 3 de tu libro: siempre los tienes preparados y puedes lanzar cada uno gratis a nivel 3 una vez por descanso corto o largo.',
  'evocador-esculpir-conjuros':
    'Al lanzar un conjuro de evocación, eliges hasta 1 + el nivel del conjuro criaturas que veas: superan automáticamente la salvación y no reciben daño si normalmente recibirían la mitad. Ideal para lanzar bolas de fuego cerca de tus aliados.',
  'evocador-evocacion-potenciada': 'Sumas tu modificador por Inteligencia a una tirada de daño de tus conjuros de evocación de mago.',
  'evocador-sobrecanalizar':
    'Al lanzar un conjuro de daño de nivel 1 a 5, puedes hacer el daño máximo. La primera vez entre descansos largos es gratis; las siguientes te hacen daño necrótico creciente.',

  'monje-golpes-potenciados': 'Tus ataques sin armas pueden hacer daño de fuerza en lugar de su tipo normal.',
  'monje-evasion':
    'Cuando un efecto te permita una salvación de Destreza para recibir la mitad del daño, no recibes nada si la superas y solo la mitad si la fallas.',
  'monje-movimiento-acrobatico': 'Sin armadura ni escudo, puedes moverte por paredes y sobre líquidos sin caerte mientras te desplazas.',
  'monje-autorrestablecimiento':
    'Al final de cada turno puedes quitarte el estado asustado, envenenado o hechizado. Además, no ganas cansancio por pasar hambre o sed.',
  'monje-concentracion-agudizada':
    'Defensa paciente con punto de concentración te da PG temporales (dos tiradas de tu dado de Artes marciales), Paso del viento puede llevarse a un aliado y Ráfaga de golpes hace tres ataques en lugar de dos.',
  'monje-desviar-energia': 'Puedes usar Desviar ataques contra cualquier tipo de daño, no solo contundente, cortante o perforante.',
  'monje-superviviente-disciplinado':
    'Eres competente en todas las tiradas de salvación, y si fallas una puedes gastar 1 punto de concentración para repetirla.',
  'monje-concentracion-perfecta':
    'Al tirar iniciativa sin usar Metabolismo asombroso, si te quedan 3 puntos de concentración o menos, recuperas hasta tener 4.',
  'monje-defensa-superior':
    'Al principio de tu turno puedes gastar 3 puntos de concentración para tener resistencia a todo el daño salvo el de fuerza durante 1 minuto.',
  'monje-cuerpo-y-mente': 'Tu Destreza y tu Sabiduría aumentan en 4, hasta un máximo de 25.',
  'guerrero-de-la-mano-abierta-plenitud-de-cuerpo':
    'Como acción adicional, recuperas PG iguales a una tirada de tu dado de Artes marciales + tu Sabiduría. Tantas veces como tu Sabiduría (mínimo 1) por descanso largo.',
  'guerrero-de-la-mano-abierta-paso-veloz':
    'Cuando uses una acción adicional que no sea Paso del viento, puedes usar también Paso del viento justo después.',
  'guerrero-de-la-mano-abierta-palma-estremecedora':
    'Al acertar un ataque sin armas, puedes gastar 4 puntos de concentración para dejar vibraciones en el objetivo. Cuando quieras (renunciando a un ataque o con tu acción), las activas: salvación de Constitución o 10d12 de daño de fuerza (la mitad si la supera).',

  'picaro-evasion':
    'Cuando un efecto te permita una salvación de Destreza para recibir la mitad del daño, no recibes nada si la superas y solo la mitad si la fallas.',
  'picaro-talentos-fiables': 'En las pruebas de habilidades o herramientas en las que eres competente, un 9 o menos en el d20 cuenta como un 10.',
  'picaro-golpe-astuto-mejorado': 'Puedes aplicar hasta dos efectos de Golpe astuto al mismo Ataque furtivo, pagando el coste de cada uno.',
  'picaro-golpes-taimados':
    'Nuevos efectos de Golpe astuto: Confundir (2d6, limita su siguiente turno), Ofuscar (3d6, lo ciega) y Noquear (6d6, lo deja inconsciente si falla la salvación).',
  'picaro-mente-escurridiza': 'Ganas competencia en las tiradas de salvación de Sabiduría y Carisma.',
  'picaro-elusivo': 'Ningún ataque contra ti tiene ventaja, salvo si estás incapacitado.',
  'picaro-golpe-de-suerte':
    'Si fallas una prueba con d20, puedes convertir el resultado en un 20. Una vez por descanso corto o largo.',
  'ladron-sigilo-supremo':
    'Nuevo efecto de Golpe astuto, Ataque sigiloso (1d6): si estás invisible por haberte escondido, atacar no te hace visible si acabas el turno tras cobertura de tres cuartos o completa.',
  'ladron-usar-objetos-magicos':
    'Puedes sintonizarte con hasta cuatro objetos mágicos, a veces usar cargas gratis (con un 6 en 1d6) y usar cualquier pergamino de conjuro con tu Inteligencia.',
  'ladron-reflejos-de-ladron':
    'En el primer asalto de cada combate juegas dos turnos: uno con tu iniciativa normal y otro con tu iniciativa menos 10.',
}

/** Resúmenes de rasgos genéricos o repetidos. */
export function genericSummary(f, { className, subclassName }) {
  const slug = f.id.replace(/-n\d+$/, '')
  const count = f.choice?.count
  if (/-mejora-de-caracteristica$/.test(slug))
    return 'Eliges una dote: normalmente Mejora de característica (+2 a una característica o +1 a dos, hasta un máximo de 20) u otra dote general para la que cumplas los requisitos.'
  if (/-rasgo-de-subclase$/.test(slug)) return `Tu subclase (${subclassName}) te da un rasgo nuevo en este nivel: consúltalo en la descripción de tu subclase.`
  if (/-don-epico$/.test(slug))
    return 'Eliges una dote de don épico (u otra dote para la que cumplas los requisitos): un poder muy fuerte que además sube una característica, hasta un máximo de 30.'
  if (/-subclase-de-/.test(slug))
    return `Eliges tu subclase de ${className.toLowerCase()} (por ejemplo, ${subclassName}), una especialización que te dará rasgos nuevos en ciertos niveles.`
  if (/-ataque-adicional$/.test(slug)) return 'Cuando haces la acción de atacar en tu turno, atacas dos veces en lugar de una.'
  if (/-maestria-con-armas$/.test(slug))
    return `Puedes usar la propiedad de maestría de ${count === 1 ? 'un tipo de arma más' : `${count} tipos de armas más`}.`
  if (/-invocaciones-sobrenaturales$/.test(slug))
    return `Aprendes ${count === 1 ? 'una invocación sobrenatural más' : `${count} invocaciones sobrenaturales más`} de tu elección.`
  if (/-metamagia$/.test(slug)) return `Aprendes ${count} opciones de metamagia más.`
  if (/-arcanum-mistico$/.test(slug)) {
    const lvl = f.choice?.note?.match(/nivel (\d)/)?.[1]
    return `Eliges un conjuro de brujo de nivel ${lvl} que puedes lanzar gratis una vez por descanso largo.`
  }
  if (slug === 'druida-forma-salvaje')
    return f.level === 4
      ? 'Aprendes dos formas de bestia más; ahora pueden ser de VD 1/2 como máximo.'
      : 'Aprendes dos formas de bestia más; ahora pueden ser de VD 1 y tener velocidad volando.'
  return null
}

/**
 * Resumen de una línea de cada opción de las listas largas (invocaciones y
 * metamagia): el asistente enseña esto y deja «Leer más» para el texto entero.
 */
export const OPTION_SUMMARIES = {
  // --- Invocaciones sobrenaturales ---------------------------------------------
  'armadura-de-sombras': 'Te lanzas armadura de mago sin gastar espacios: CA 13 + Destreza sin armadura.',
  'castigo-arcano': 'Al acertar con tu arma de pacto, gastas un espacio de pacto para hacer más daño de fuerza y puedes derribar al objetivo.',
  'descarga-agonica': 'Sumas tu modificador por Carisma al daño de un truco de brujo, normalmente descarga sobrenatural.',
  'descarga-ahuyentadora': 'Al acertar con un truco de ataque (como descarga sobrenatural), empujas al objetivo hasta 3 m.',
  'devorador-de-vida': 'Tu arma de pacto hace 1d6 de daño extra y te curas gastando un dado de puntos de golpe.',
  'don-de-las-profundidades': 'Respiras bajo el agua y nadas tan rápido como andas.',
  'don-de-los-protectores': 'Quien escriba su nombre en tu Libro de las sombras se queda a 1 PG en lugar de caer a 0, una vez por descanso largo.',
  'filo-sediento': 'Atacas dos veces con tu arma de pacto cuando haces la acción de atacar.',
  'hoja-devoradora': 'Atacas tres veces con tu arma de pacto cuando haces la acción de atacar.',
  'inversion-del-amo-de-las-cadenas': 'Tu familiar mejora: vuela o nada, ataca con tu acción adicional y hace más daño.',
  'lanza-sobrenatural': 'Un truco de daño de brujo alcanza mucho más lejos (10 m más por cada nivel de brujo).',
  'lecciones-de-los-primeros': 'Ganas una dote de origen a tu elección.',
  'maestro-de-las-formas-innumerables': 'Lanzas alterar el propio aspecto cuando quieras, sin gastar espacios.',
  'mascara-de-los-mil-rostros': 'Lanzas disfrazarse cuando quieras, sin gastar espacios.',
  'mente-sobrenatural': 'Ventaja en las tiradas de salvación para mantener la concentración.',
  'mirada-de-las-dos-mentes': 'Ves y oyes a través de los sentidos de una criatura voluntaria que tocas.',
  'pacto-de-la-cadena': 'Tienes un familiar especial (diablillo, duende, quasit...) que puede atacar en tu lugar.',
  'pacto-del-filo': 'Haces aparecer un arma mágica con la que atacas usando tu Carisma.',
  'pacto-del-grimorio': 'Un libro mágico con tres trucos y dos rituales de cualquier clase.',
  'paso-ascendente': 'Te lanzas levitar cuando quieras, sin gastar espacios.',
  'salto-sobrenatural': 'Te lanzas salto cuando quieras, sin gastar espacios.',
  'susurros-del-sepulcro': 'Lanzas hablar con los muertos cuando quieras, sin gastar espacios.',
  'uno-con-las-sombras': 'En luz tenue u oscuridad te vuelves invisible sin gastar espacios.',
  'vigor-infernal': 'Te lanzas falsa vida sin gastar espacios y con los puntos de golpe temporales al máximo.',
  'vision-bruja': 'Tienes visión verdadera hasta 9 m: ves lo invisible y a través de ilusiones.',
  'visiones-brumosas': 'Lanzas imagen silenciosa cuando quieras, sin gastar espacios.',
  'visiones-de-reinos-remotos': 'Lanzas ojo arcano cuando quieras, sin gastar espacios.',
  'vista-del-diablo': 'Ves con normalidad en la oscuridad, también la mágica, hasta 36 m.',
  // --- Metamagia ---------------------------------------------------------------
  'conjuro-acelerado': '2 puntos: un conjuro de una acción lo lanzas como acción adicional.',
  'conjuro-buscador': '1 punto: si fallas el ataque de un conjuro, repites el d20.',
  'conjuro-cuidadoso': '1 punto: tus aliados superan sin más la salvación contra tu conjuro de área.',
  'conjuro-distante': '1 punto: el conjuro llega el doble de lejos (o a 9 m si era de toque).',
  'conjuro-extendido': '1 punto: el conjuro dura el doble y tienes ventaja para mantener la concentración.',
  'conjuro-gemelo': '1 punto: el conjuro cuenta como de un nivel más, para afectar a un objetivo más.',
  'conjuro-intensificado': '2 puntos: un objetivo tiene desventaja en la salvación contra tu conjuro.',
  'conjuro-potenciado': '1 punto: repites algunos dados de daño del conjuro.',
  'conjuro-sutil': '1 punto: lanzas el conjuro sin hablar ni gesticular, sin que nadie lo note.',
  'conjuro-transmutado': '1 punto: cambias el tipo de daño del conjuro (ácido, frío, fuego, relámpago, trueno o veneno).',
}
