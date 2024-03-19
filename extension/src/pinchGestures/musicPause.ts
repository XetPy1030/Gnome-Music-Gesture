import Clutter from '@gi-types/clutter';
import {TouchpadPinchGesture} from '../trackers/pinchTracker';
import Shell from '@gi-types/shell';
import {getVirtualKeyboard, IVirtualKeyboard} from '../utils/keyboard';
import St from '@gi-types/st';
import {imports} from 'gnome-shell';
import {easeActor} from '../utils/environment';
import {WIGET_SHOWING_DURATION} from '../../constants';

const Main = imports.ui.main;
const Util = imports.misc.util;

const END_OPACITY = 0;
const END_SCALE = 0.5;

declare type Type_TouchpadPinchGesture = typeof TouchpadPinchGesture.prototype;

enum MusicPauseGestureState {
	DEFAULT = 0,
	PAUSE = 1,
}

export class MusicPauseExtension implements ISubExtension {
	private _keyboard: IVirtualKeyboard;
	private _pinchTracker: Type_TouchpadPinchGesture;
	private _preview: St.Widget;

	constructor(nfingers: number[]) {
		this._preview = new St.Widget({
			reactive: false,
			style_class: 'gie-close-window-preview',
			visible: false,
		});
		this._preview.set_pivot_point(0.5, 0.5);
		Main.layoutManager.uiGroup.add_child(this._preview);

		this._pinchTracker = new TouchpadPinchGesture({
			nfingers: nfingers,
			allowedModes: Shell.ActionMode.NORMAL,
		});
		this._keyboard = getVirtualKeyboard();
		this._pinchTracker.connect('begin', this.gestureBegin.bind(this));
		this._pinchTracker.connect('update', this.gestureUpdate.bind(this));
		this._pinchTracker.connect('end', this.gestureEnd.bind(this));
	}

	destroy() {
		this._pinchTracker?.destroy();
		this._preview.destroy();
	}

	gestureBegin(tracker: Type_TouchpadPinchGesture) {
		tracker.confirmPinch(
			1,
			[MusicPauseGestureState.DEFAULT, MusicPauseGestureState.PAUSE],
			MusicPauseGestureState.DEFAULT,
		);

		const width = Main.layoutManager.primaryMonitor.width;
		const height = Main.layoutManager.primaryMonitor.height;
		const previewWidth = width * 0.5;
		const previewHeight = height * 0.5;
		const previewX = (width - previewWidth) / 2;
		const previewY = (height - previewHeight) / 2;
		this._preview.set_position(previewX, previewY);
		this._preview.set_size(previewWidth, previewHeight);

		// animate showing widget
		this._preview.opacity = 0;
		this._preview.show();
		easeActor(this._preview, {
			opacity: 255,
			mode: Clutter.AnimationMode.EASE_OUT_QUAD,
			duration: WIGET_SHOWING_DURATION,
		});
	}

	gestureUpdate(_tracker: unknown, progress: number): void {
		progress = MusicPauseGestureState.DEFAULT - progress;
		const scale = Util.lerp(1, END_SCALE, progress);
		this._preview.set_scale(scale, scale);
		this._preview.opacity = Util.lerp(255, END_OPACITY, progress);
	}

	gestureEnd(_tracker: unknown, duration: number, endProgress: number) {
		if (endProgress === MusicPauseGestureState.PAUSE) {
			this._keyboard.sendKeys([Clutter.KEY_AudioPlay]);
		}
		this._animatePreview(endProgress === MusicPauseGestureState.PAUSE, duration);
	}

	private _animatePreview(gestureCompleted: boolean, duration: number) {
		easeActor(this._preview,  {
			opacity: gestureCompleted ? END_OPACITY : 255,
			scaleX: gestureCompleted ? END_SCALE : 1,
			scaleY: gestureCompleted ? END_SCALE : 1,
			duration,
			mode: Clutter.AnimationMode.EASE_OUT_QUAD,
			onStopped: () => {
				this._gestureAnimationDone();
			},
		});
	}

	private _gestureAnimationDone() {
		this._preview.hide();
		this._preview.opacity = 255;
		this._preview.set_scale(1, 1);
	}
}
