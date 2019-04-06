import * as React from "react";
import { Route, BrowserRouter, Switch, NavLink, Redirect } from "react-router-dom";
import { PaintingEvolverPage } from "./pages/paintingEvolver/PaintingEvolverPage"
import { MultiEvolverPage } from "./pages/multiEvolver/MultiEvolverPage";
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
            <Switch>
            <Route path="/" exact={true} render={() => <Redirect to="/classic" />}/>
            <Route path="/classic" exact={true} component={PaintingEvolverPage} />
            <Route path="/multi" exact={true} component={MultiEvolverPage} />u
            </Switch>
            
        </BrowserRouter>;
    }
}