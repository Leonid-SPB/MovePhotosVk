/**
*	Site-specific configuration settings for Highslide JS
*/
hs.graphicsDir = 'graphics/';
hs.showCredits = false;
hs.outlineType = 'custom';
hs.fadeInOut = true;
hs.padToMinWidth = true;
hs.allowMultipleInstances = false;
hs.enableKeyListener = false;
hs.captionEval = 'this.a.title';
hs.registerOverlay({
    html: '<div class="close-simple-white" onclick="return hs.close(this)" title="Закрыть"></div>',
    position: 'top right',
    useOnHtml: true,
    fade: 2 // fading the semi-transparent overlay looks bad in IE
});

// Russian language strings
hs.lang = {
	cssDirection: 'ltr',
	loadingText: 'Загружается...',
	loadingTitle: 'Нажмите для отмены',
	focusTitle: 'Нажмите чтобы поместить на передний план',
	fullExpandTitle: 'Развернуть до оригинального размера',
	creditsText: 'Использует <i>Highslide JS</i>',
	creditsTitle: 'Перейти на домашнюю страницу Highslide JS',
	previousText: 'Предыдущее',
	nextText: 'Следующее',
	moveText: 'Переместить',
	closeText: 'Закрыть',
	closeTitle: 'Закрыть (esc)',
	resizeTitle: 'Изменить размер',
	playText: 'Слайдшоу',
	playTitle: 'Начать слайдшоу (пробел)',
	pauseText: 'Пауза',
	pauseTitle: 'Приостановить слайдшоу (пробел)',
	previousTitle: 'Предыдущее (стрелка влево)',
	nextTitle: 'Следующее (стрелка вправо)',
	moveTitle: 'Переместить',
	fullExpandText: 'Оригинальный размер',
	number: 'Изображение %1 из %2',
	restoreTitle: 'Нажмите чтобы закрыть изображение.'
};
