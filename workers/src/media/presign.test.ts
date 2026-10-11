import { describe, it, expect } from 'vitest'
import { presignGet, uriEncode } from './presign.js'
import { objectKeyFromUrl, pickFrontPage, represignIndex, b2Config } from './mediaIndex.js'

describe('presignGet (SigV4)', () => {
  it('matches the AWS documentation example for a presigned S3 GET', async () => {
    // https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
    const url = await presignGet(
      { accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'us-east-1' },
      'examplebucket.s3.amazonaws.com',
      '/test.txt',
      86400,
      new Date('2013-05-24T00:00:00Z'),
    )
    expect(url).toContain('X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request')
    expect(url).toContain('X-Amz-Date=20130524T000000Z')
    expect(url).toContain('X-Amz-Expires=86400')
    expect(url).toMatch(/X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404$/)
  })

  it('uri-encodes per RFC 3986', () => {
    expect(uriEncode("a b!'()*/c", false)).toBe('a%20b%21%27%28%29%2A/c')
    expect(uriEncode('a/b')).toBe('a%2Fb')
  })
})

describe('media index helpers', () => {
  const env = { B2_KEY_ID: 'k', B2_APP_KEY: 's', B2_BUCKET: 'rs-media', B2_REGION: 'us-west-004' }

  it('recovers object keys from path-style, virtual-hosted and presigned URLs', () => {
    expect(objectKeyFromUrl('https://s3.us-west-004.backblazeb2.com/rs-media/assets/ab/cd/x.png', 'rs-media')).toBe('assets/ab/cd/x.png')
    expect(objectKeyFromUrl('https://rs-media.s3.us-west-004.backblazeb2.com/assets/x.png?X-Amz-Signature=old', 'rs-media')).toBe('assets/x.png')
    expect(objectKeyFromUrl('https://cdn.example.com/rs-media/x.png', 'rs-media')).toBeNull()
    expect(objectKeyFromUrl('not a url', 'rs-media')).toBeNull()
  })

  it('re-presigns B2 URLs and leaves foreign URLs alone', async () => {
    const cfg = b2Config(env)!
    const out = await represignIndex(
      {
        world_id: 'live',
        media: [
          { kind: 'front_page', b2_url: 'https://s3.us-west-004.backblazeb2.com/rs-media/a/b.png?X-Amz-Expires=1', manifest_uri: 'https://cdn.example.com/m.json' },
        ],
      },
      cfg,
    )
    expect(out.media[0].b2_url).toMatch(/^https:\/\/s3\.us-west-004\.backblazeb2\.com\/rs-media\/a\/b\.png\?X-Amz-Algorithm=AWS4-HMAC-SHA256/)
    expect(out.media[0].b2_url).not.toContain('X-Amz-Expires=1&')
    expect(out.media[0].manifest_uri).toBe('https://cdn.example.com/m.json')
  })

  it('b2Config needs all four credentials', () => {
    expect(b2Config({ ...env, B2_APP_KEY: undefined })).toBeNull()
    expect(b2Config(env)?.host).toBe('s3.us-west-004.backblazeb2.com')
    expect(b2Config({ ...env, B2_S3_ENDPOINT: 'https://s3.eu-central-003.backblazeb2.com' })?.host).toBe('s3.eu-central-003.backblazeb2.com')
  })

  it('picks the newest non-sample front page, never a broadcast', () => {
    const idx = {
      media: [
        { kind: 'front_page', sim_date: '2027-01-01', b2_url: 'a' },
        { kind: 'front_page', sim_date: '2028-01-01', b2_url: 'b', provenance: { sample: true } },
        { kind: 'front_page', sim_date: '2027-06-01', b2_url: 'c', provenance: { real_world_data_cutoff: null, live_world: true } },
        { kind: 'broadcast', sim_date: '2029-01-01', b2_url: 'd' },
      ],
    }
    expect(pickFrontPage(idx)?.b2_url).toBe('c')
    expect(pickFrontPage({ media: [{ kind: 'broadcast', b2_url: 'd' }] })).toBeNull()
    expect(pickFrontPage(null)).toBeNull()
  })
})
