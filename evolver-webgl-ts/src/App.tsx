import * as React from "react";
import { Route, BrowserRouter, Switch, NavLink, Redirect } from "react-router-dom";
import { PaintingEvolverPage } from "./pages/paintingEvolver/PaintingEvolverPage"
// Maybe someday use multi-page support
// import { Route, BrowserRouter } from "react-router-dom";
// import { createBrowserHistory } from "history";

/**
 * This is the wrapper application element. If this application
 * ever needs to support multiple pages, that
 * multi-page support would be configured here.
 * Currently only the calculator page is rendered.
 */
export class App extends React.Component {

    render() {
        return <BrowserRouter>
            <Route path="/" exact={true} component={PaintingEvolverPage} />
        </BrowserRouter>;
    }
}