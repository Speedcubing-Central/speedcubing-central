import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * How much of the screen the OS keyboard is currently covering, in points.
 *
 * On iOS the keyboard is drawn *over* the app without resizing anything under
 * it, so a control at the bottom of the screen is simply hidden the moment you
 * use it. Anything bottom-anchored that owns a text field has to move itself,
 * and this is the number to move by.
 *
 * `keyboardWillShow` on iOS rather than `keyboardDidShow`: the "will" events
 * fire at the start of the system animation, so the surface travels with the
 * keyboard instead of jumping into place after it has arrived. Android only
 * emits the "did" pair.
 *
 * Note this is deliberately not a `KeyboardAvoidingView`. That works by taking
 * height away from its children, which on the Timer column is the one thing that
 * cannot happen (see HANDOFF trap 3, and the trap on text inputs). Reporting the
 * height and letting the caller decide what to do with it keeps that choice
 * where the layout knowledge is.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
