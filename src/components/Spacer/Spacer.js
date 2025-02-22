import styled from 'styled-components';

import pixelSrc from '../../assets/pixel.png';

const Spacer = styled.img.attrs({
  src: pixelSrc,
})`
  display: block;
  width: ${props => props.size}px;
  height: ${props => props.size}px;
`;

export default Spacer;
