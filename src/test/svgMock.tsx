import { View } from 'react-native';
import type { ComponentProps } from 'react';

// Stands in for every `import Icon from './something.svg'` under Jest. Renders
// a plain View so the icon occupies a node in the tree and accepts the same
// width/height/color props call sites pass, without react-native-svg or the
// Metro transformer being involved.
//
// testID makes icons findable when a test genuinely needs to assert one is
// present - a card whose only indicator of state is its icon, for example.
export default function SvgMock(props: ComponentProps<typeof View>) {
  return <View testID="svg-mock" {...props} />;
}
