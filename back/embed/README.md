## Embedded Chat AI

Chat AI can be embedded in other websites with public routes that can be added as embedded iframes in HTML. Each route is configured in the Chat AI app as a JSON file.

## HTML Embedding

Here is an example of how a custom configuration of Chat AI can be embedded into your website:

```html
<HTML>
<iframe 
  id="ChatAI"
  title="Embedded Chat AI"
  width="500"
  height="800"
  src="https://chat-ai.academiccloud.de/embed/example/myroute">
</iframe>
</HTML>
```

The exact subpaths after `embed/` are defined in the configuration files described below.

## Configuration

The path, API key and modifications for each embedded route is configured in a JSON file. An example is provided here. The modifications are injected into all chat messages coming through this route, replacing parameters from the original message.

#### JSON Config Example

```json
{
    "path": "example/myroute",
    "apiKey": "abcdefghijklmnopqrstuvw0123456789",
    "modify": {
        "system_prompt": "You are a bot designed to showcase an example of an embedded Chat AI webpage. When responding to the user, always remember that this is an example of an embedded webpage",
        "model": "meta-llama-3.1-8b-rag",
        "arcana": {
            "id":"myuser/myarcana"
        }
    }
}
```

The configurable parameters are:
- `path`: The subpath to this embedded page
- `apiKey`: API key to be used for all requests coming through this path
- `modify`: Modifications to be made for all messages, replacing parameters such as `system_prompt`, `model`, `arcana`, `top_p`, and `temperature`

