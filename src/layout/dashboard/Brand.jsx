import heartbeatMark from '../../../images/pictures/600ppi/logo-mark.webp';

export default function Brand() {
  return (
    <a className="brand" href="#top" aria-label="بازگشت به ابتدای صفحه">
      <span className="brand__mark">
        <img src={heartbeatMark} alt="" />
      </span>
      <span className="brand__word">تپش</span>
    </a>
  );
}
